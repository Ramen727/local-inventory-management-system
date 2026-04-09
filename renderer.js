const { ipcRenderer } = require('electron');

// ==========================================
// BUTTON LISTENERS (Add your other buttons here as needed)
// ==========================================
document.getElementById('btn-new-item').addEventListener('click', () => {
    ipcRenderer.send('open-add-window');
});


// ==========================================
// DYNAMIC TABLE RENDERING
// ==========================================
const tbody = document.getElementById('inventory-body');

ipcRenderer.on('update-ui-table', (event, partsList) => {
    tbody.innerHTML = ''; // Clears the old table

    partsList.forEach(part => { 
        const tr = document.createElement('tr'); 
        
        tr.innerHTML = `
            <td><input type="checkbox" class="item-checkbox" value="${part.partNo}"></td>
            <td>${part.partNo || ''}</td>
            <td>${part.partRefNo || ''}</td>
            <td>${part.description || ''}</td>
            <td>${part.qty === 0 ? '0' : (part.qty || '')}</td>
            <td>${part.price ? 'RM' + part.price : ''}</td>
            <td>
                <input type="text" class="inline-remark" data-id="${part.partNo}" value="${part.remark || ''}" placeholder="Add remark..." style="width: 100%; border: none; background: transparent; outline: none;">
            </td>
        `;
        
        tbody.appendChild(tr); 
    });
});


// ==========================================
// UNIVERSAL SEARCH FUNCTIONALITY
// ==========================================
const searchInput = document.getElementById('search');

searchInput.addEventListener('keyup', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#inventory-body tr');

    rows.forEach(row => {
        // Look at Part No (1), Ref No (2), Description (3)
        const partNo = row.cells[1].innerText.toLowerCase();
        const refNo = row.cells[2].innerText.toLowerCase();
        const desc = row.cells[3].innerText.toLowerCase();

        // If search term is in any of those 3 columns, show the row
        if (partNo.includes(searchTerm) || refNo.includes(searchTerm) || desc.includes(searchTerm)) {
            row.style.display = ''; 
        } else {
            row.style.display = 'none'; 
        }
    });
});

// ==========================================
// REMOVE ITEM LOGIC
// ==========================================
document.getElementById('btn-remove-item').addEventListener('click', () => {
    // 1. Find every checkbox on the screen that is currently checked
    const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
    
    // 2. If they didn't check any boxes, show a quick warning and stop
    if (checkedBoxes.length === 0) {
        alert("Please select at least one item to remove.");
        return;
    }

    // 3. Ask for confirmation (a crucial safety feature so they don't accidentally delete stock!)
    if (confirm(`Are you sure you want to permanently delete ${checkedBoxes.length} item(s)?`)) {
        
        // 4. Gather up the Part Numbers from the checked boxes
        const partsToDelete = Array.from(checkedBoxes).map(box => box.value);
        
        // 5. Send the list of Part Numbers to the backend to be deleted
        ipcRenderer.send('delete-parts', partsToDelete);
    }
});

// ==========================================
// ADD / DEDUCT STOCK LOGIC
// ==========================================

// Helper function to figure out which box the admin checked
function getSelectedPart() {
    const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        alert("Please check the box of an item first.");
        return null;
    }
    if (checkedBoxes.length > 1) {
        alert("Please select ONLY ONE item to update stock.");
        return null;
    }
    
    // Grab the specific row they checked
    const row = checkedBoxes[0].closest('tr');
    return {
        partNo: checkedBoxes[0].value,         // Column 1
        description: row.cells[3].innerText,   // Column 4
        qty: row.cells[4].innerText            //Column 5
    };
}

// Wire up the Add Stock button
document.getElementById('btn-add-stock').addEventListener('click', () => {
    const partData = getSelectedPart();
    if (partData) ipcRenderer.send('open-add-stock-window', partData);
});

// Wire up the Deduct Stock button
document.getElementById('btn-deduct-stock').addEventListener('click', () => {
    const partData = getSelectedPart();
    if (partData) ipcRenderer.send('open-deduct-window', partData);
});

// ==========================================
// INLINE REMARK AUTO-SAVE
// ==========================================
document.getElementById('inventory-body').addEventListener('change', (e) => {
    // Check if the thing they just typed in was an inline-remark box
    if (e.target.classList.contains('inline-remark')) {
        const updatedRemark = e.target.value;
        const partNumber = e.target.getAttribute('data-id'); 
        
        // Send the updated remark to main.js to save it permanently
        ipcRenderer.send('save-inline-remark', { partNo: partNumber, remark: updatedRemark });
    }
});