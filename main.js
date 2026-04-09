const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// 1. Get the safe, hidden "User Data" folder path from Windows/Mac
const userDataPath = app.getPath('userData');

// 2. Tell the app to save parts.json inside that safe folder instead
const dataFilePath = path.join(userDataPath, 'parts.json');

let win; 
let currentItemToProcess = null; // Holds data for the Add/Deduct popups

// ==========================================
// FILE SYSTEM HELPERS
// ==========================================

// Helper to READ data from the JSON file
function loadParts() {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log("No file found or file is empty, starting with an empty list.");
        return []; 
    }
}

// Helper to SAVE data to the JSON file
function saveParts(partsArray) {
    fs.writeFileSync(dataFilePath, JSON.stringify(partsArray, null, 2)); 
    
    // Instantly push the updated list to the front-end!
    if (win) {
        win.webContents.send('update-ui-table', partsArray);
    }
}

// ==========================================
// MAIN WINDOW SETUP
// ==========================================

const createWindow = () => {
  win = new BrowserWindow({
    autoHideMenuBar: true,
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.maximize();
  win.loadFile('index.html');

  // When the window finishes loading, send it the initial data
  win.webContents.on('did-finish-load', () => {
      const initialData = loadParts();
      win.webContents.send('update-ui-table', initialData);
  });
};

// ==========================================
// DATABASE OPERATIONS (New Part / Delete / Remarks)
// ==========================================

// 1. Open the "Add New Item" blank form
ipcMain.on('open-add-window', () => {
  const addWin = new BrowserWindow({
    width: 400, height: 600, parent: win, modal: true, frame:false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  addWin.loadFile('add-item.html');
});

// 2. Catch the new part data and save it
ipcMain.on('submit-new-item', (event, itemData) => {
    const parts = loadParts(); 
    parts.push(itemData);      
    saveParts(parts);          
    console.log("Saved new part:", itemData.partNo);
});

// 2.5 Quick scan to check for duplicate numbers before saving!
ipcMain.on('check-duplicate', (event, newItem) => {
    const parts = loadParts();
    
    // Look for exact matches
    const duplicatePartNo = parts.find(p => p.partNo === newItem.partNo);
    // Only check Ref No if they actually typed one (prevents matching empty boxes)
    const duplicateRefNo = newItem.partRefNo !== "" ? parts.find(p => p.partRefNo === newItem.partRefNo) : null;

    // Send the warning message back if we found a match
    if (duplicatePartNo) {
        event.returnValue = { isDuplicate: true, message: `Warning: Part No. "${newItem.partNo}" already exists in the database!` };
    } else if (duplicateRefNo) {
        event.returnValue = { isDuplicate: true, message: `Warning: Part Ref No. "${newItem.partRefNo}" already exists in the database!` };
    } else {
        event.returnValue = { isDuplicate: false }; // All clear!
    }
});

// 3. Catch the list of Part Numbers to delete and update the file
ipcMain.on('delete-parts', (event, partNosToDelete) => {
    let parts = loadParts();
    
    // Keep only the parts that are NOT in the delete list
    parts = parts.filter(part => !partNosToDelete.includes(part.partNo));
    
    saveParts(parts);
    console.log("Deleted parts. Remaining inventory saved.");
    
    // Tell the frontend to immediately redraw the table
    if (win) win.webContents.send('update-ui-table', parts);
});

// 4. Catch the auto-save command for inline remarks!
ipcMain.on('save-inline-remark', (event, data) => {
    const parts = loadParts(); 
    const partIndex = parts.findIndex(p => p.partNo === data.partNo);
    
    if (partIndex !== -1) {
        parts[partIndex].remark = data.remark;
        saveParts(parts);
        console.log(`Saved new remark for ${data.partNo}`);
    }
});

// ==========================================
// STOCK OPERATIONS (Add / Deduct Quantities)
// ==========================================

// 1. Open the "Add Stock" popup
ipcMain.on('open-add-stock-window', (event, itemData) => {
    currentItemToProcess = itemData;
    const addStockWin = new BrowserWindow({
      width: 400, height: 350, parent: win, modal: true, frame: false, autoHideMenuBar: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    addStockWin.loadFile('add-stock.html');
});

// 2. Open the "Deduct Stock" popup
ipcMain.on('open-deduct-window', (event, itemData) => {
  currentItemToProcess = itemData;
  const deductWin = new BrowserWindow({
    width: 400, height: 350, parent: win, modal: true, frame: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  deductWin.loadFile('deduct-item.html');
});

// 3. Both popups will ask for the item data when they load
ipcMain.on('request-item-data', (event) => {
  event.reply('receive-item-data', currentItemToProcess);
});

// 4. Catch the deducted math and save it
ipcMain.on('submit-deduction', (event, deductAmount) => {
    const parts = loadParts();
    const partIndex = parts.findIndex(p => p.partNo === currentItemToProcess.partNo);
    
    if (partIndex !== -1) {
        // 1. Grab the current quantity and force it to be a real Number (not text)
        let currentQty = parseInt(parts[partIndex].qty || 0, 10);
        
        // 2. Do the math!
        let newTotal = currentQty - deductAmount;
        
        // Prevent the stock from accidentally dropping below zero
        if (newTotal < 0) newTotal = 0; 

        // 3. Save the new total back to the database
        parts[partIndex].qty = newTotal; 
        saveParts(parts);
        console.log(`Saved deducted quantity for ${currentItemToProcess.partNo}`);
    }
});

// 5. Catch the added math and save it
ipcMain.on('submit-addition', (event, addedAmount) => {
    const parts = loadParts();
    const partIndex = parts.findIndex(p => p.partNo === currentItemToProcess.partNo);
    
    if (partIndex !== -1) {
        // 1. Grab the current quantity and force it to be a real Number
        let currentQty = parseInt(parts[partIndex].qty || 0, 10);
        
        // 2. Do the math!
        parts[partIndex].qty = currentQty + addedAmount; 
        
        // 3. Save the new total back to the database
        saveParts(parts);
        console.log(`Saved added quantity for ${currentItemToProcess.partNo}`);
    }
});

// Start the app
app.whenReady().then(createWindow);