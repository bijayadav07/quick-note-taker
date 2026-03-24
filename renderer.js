window.addEventListener('DOMContentLoaded', () => {
    const textArea = document.getElementById('note');
    const saveButton = document.getElementById('saveBtn');
    const savedNote = await window.electronAPI.loadNote();
    textArea.value = savenote;
    saveButton.addEventListener('click', async () => {
        await window.electronAPI.saveNote(textArea.value);
        alert('Note saved successfully!');
    });

});

