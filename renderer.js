const { ipcRenderer } = require('electron');

// Toggle row highlight when a checkbox is clicked
document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
        e.target.closest('tr').classList.toggle('selected');
    }
});

// Helper function to safely get the selected row's data
function getSelectedRowData(checkedBoxes) {
    const row = checkedBoxes[0].closest('tr');
    return {
        name: row.cells[1].innerText,
        serial: row.cells[2].innerText,
        qty: parseInt(row.cells[3].innerText)
    };
}

// 1. ADD STOCK (Requires 1 Checkbox)
document.getElementById('btn-add-stock').addEventListener('click', () => {
    const checked = document.querySelectorAll('tbody input[type="checkbox"]:checked');
    if (checked.length !== 1) {
        alert("Please select exactly ONE item to add stock.");
        return; 
    }
    
    const itemData = getSelectedRowData(checked);
    ipcRenderer.send('open-add-stock-window', itemData);
    
    // Clean up UI
    checked[0].checked = false;
    checked[0].closest('tr').classList.remove('selected');
});

// 2. DEDUCT STOCK (Requires 1 Checkbox)
document.getElementById('btn-deduct-stock').addEventListener('click', () => {
    const checked = document.querySelectorAll('tbody input[type="checkbox"]:checked');
    if (checked.length !== 1) {
        alert("Please select exactly ONE item to deduct stock.");
        return; 
    }
    
    const itemData = getSelectedRowData(checked);
    ipcRenderer.send('open-deduct-window', itemData);
    
    // Clean up UI
    checked[0].checked = false;
    checked[0].closest('tr').classList.remove('selected');
});

// 3. ADD NEW ITEM (Database operation: Opens blank form)
document.getElementById('btn-new-item').addEventListener('click', () => {
    ipcRenderer.send('open-add-window');
});

// 4. REMOVE ITEM (Database operation: Deletes whole rows)
document.getElementById('btn-remove-item').addEventListener('click', () => {
    const checked = document.querySelectorAll('tbody input[type="checkbox"]:checked');
    if (checked.length === 0) {
        alert("Please select at least one item to remove.");
        return; 
    }
    
    if (confirm(`Are you sure you want to permanently delete ${checked.length} part(s)?`)) {
        const serialsToDelete = [];
        checked.forEach(checkbox => {
            const row = checkbox.closest('tr');
            serialsToDelete.push(row.cells[2].innerText);
            row.remove(); // Visually delete it instantly
        });
        ipcRenderer.send('delete-items', serialsToDelete);
    }
});

// ==========================================
// DYNAMIC TABLE RENDERING
// ==========================================
const tbody = document.getElementById('inventory-body');

ipcRenderer.on('update-ui-table', (event, partsList) => {
    // 1. Wipe the current table clean so we don't duplicate items
    tbody.innerHTML = ''; 

    // 2. Loop through the parts.json data
    partsList.forEach(part => {
        
        // 3. Create a brand new HTML row (tr)
        const tr = document.createElement('tr');
        
        // 4. Fill the row with the data
        tr.innerHTML = `
            <td><input type="checkbox"></td>
            <td>${part.name}</td>
            <td>${part.serial}</td>
            <td>${part.qty}</td>
        `;
        
        // 5. Attach the finished row to the table
        tbody.appendChild(tr);
    });
});