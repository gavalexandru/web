 const selectElement = document.getElementById('test-select');
 selectElement.value=''

  window.addEventListener('change', () => {
    alert(selectElement.value);
  });