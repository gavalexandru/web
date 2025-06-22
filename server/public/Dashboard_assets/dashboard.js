 const selectElement = document.getElementById('test-select');
 selectElement.value='';

 const selectGoogleElement = document.getElementById('google-select');
 selectGoogleElement.value='';

 const selectOneDriveElement = document.getElementById('onedrive-select');
 selectOneDriveElement.value='';

 const selectDropboxElement = document.getElementById('dropbox-select');
 selectDropboxElement.value='';

 const overlay = document.getElementById("response-overlay");

 const errorPopup = document.getElementById("error-popup-content");
 const errorTitleElement = document.getElementById("error-title");
 const errorMessageElement = document.getElementById("error-message");
 const errorTryAgainButton = document.getElementById("error-try-again-button");

 const successPopup = document.getElementById("success-popup-content");
 const successTitleElement = document.getElementById("success-title");
 const successMessageElement = document.getElementById("success-message");
 const successCompletedButton = document.getElementById("success-completed-button");

const storageBar = document.querySelectorAll('.progress-bar-fill');
const storageDetails = document.querySelectorAll('.storage-item-details');

const googleStorageBar = storageBar[0];
const googleDetails = storageDetails[0];
const googleSpans = googleDetails.querySelectorAll('span');
const googleFileCount = googleSpans[0];
const googleSpace = googleSpans[1];

const onedriveStorageBar = storageBar[1];
const onedriveDetails = storageDetails[1];
const onedriveSpans = onedriveDetails.querySelectorAll('span');
const onedriveFileCount = onedriveSpans[0];
const onedriveSpace = onedriveSpans[1];

const dropboxStorageBar = storageBar[2];
const dropboxDetails = storageDetails[2];
const dropboxSpans = dropboxDetails.querySelectorAll('span');
const dropboxFileCount = dropboxSpans[0];
const dropboxSpace = dropboxSpans[1];

const fileName = document.querySelector('.file-name:nth-of-type(1)');
const fileSize = document.querySelector('.file-size-value:nth-of-type(1)');

const GOOGLE_CLIENT_ID = '333322459908-4eodgifc768jlntndc53iscud28icr1a.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyApZarM2-rCfFMqCZ8Cg80sutnNPsOU7UQ';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive';
const GOOGLE_DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

const dropbox_clientId = 'ew23aw4zu2gogc9';
const dropbox_redirectUri = 'http://localhost:8082/dashboard'; 
const dropbox_state = 'dropbox-' + generateRandomState();
localStorage.setItem('oauth_state', dropbox_state);
const dropbox_authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${dropbox_clientId}&redirect_uri=${encodeURIComponent(dropbox_redirectUri)}&state=${dropbox_state}`;

const ONEDRIVE_CLIENT_ID = '8e21fb46-bfa1-4869-a7e0-e8ab84a55eac';
const ONEDRIVE_REDIRECT_URI = 'http://localhost:8082/dashboard';
const ONEDRIVE_SCOPE = 'Files.ReadWrite offline_access openid profile User.Read';
const onedrive_state = 'onedrive-' + generateRandomState();
localStorage.setItem('onedrive_oauth_state', onedrive_state);
const onedrive_authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${ONEDRIVE_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(ONEDRIVE_REDIRECT_URI)}&response_mode=query&scope=${encodeURIComponent(ONEDRIVE_SCOPE)}&state=${onedrive_state}`;

const uploadProviderPopup = document.getElementById("upload-provider-popup");
const providerButtons = document.querySelectorAll(".provider-button");
const cancelUploadButton = document.getElementById("cancel-upload-button");
let filesToUpload = null;

    selectGoogleElement.addEventListener('change', () => {
        const action = selectGoogleElement.value;
        if (!action) return;

        if (action === "Logging in - Google Drive") {
            handleAuthClick();
        } else if (action === "Disconnecting - Google Drive") {
            logoutGoogle();
        } else {
            alert(action);
        }
        selectGoogleElement.value = '';
    });

    selectOneDriveElement.addEventListener('change', () => {
        const action = selectOneDriveElement.value;
        if (!action) return;

        if (action === "Logging in - One Drive") {
            redirectToOneDrive();   
        } else if (action === "Disconnecting - One Drive") {
            logoutOneDrive();
        } else {
            alert(action);
        }
        selectOneDriveElement.value = '';
    });

    selectDropboxElement.addEventListener('change', () => {
        const action = selectDropboxElement.value;
        if (!action) return;

        if (action === "Logging in - Dropbox") {
            redirectToDropbox();    
        } else if (action === "Disconnecting - Dropbox") {
            logoutDropbox();
        } else {
            alert(action);
        }
        selectDropboxElement.value = '';
    });


  function generateRandomState(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = '';
  for (let i = 0; i < length; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}

async function checkLoginStatus() {
    try {
        const response = await fetch('http://localhost:8082/api/logged', {
            method: 'POST',
            credentials: 'include'
        });
        errorTryAgainButton.onclick = closeOverlay();
        if (response.ok) {
            const data = await response.json();
            console.log("Logged in as:", data);
        } else {
            console.log("Not logged in");
            errorTryAgainButton.addEventListener("click",returnL);
            errorTryAgainButton.textContent="Return to Login";
            errorTitleElement.textContent = "You are not connected!";
            errorMessageElement.textContent = response.message;
            errorPopup.style.display = "flex";
        }
    } catch (error) {
        console.error("Error checking login status:", error);
        errorTryAgainButton.addEventListener("click",returnL);
        errorTryAgainButton.textContent="Return to Login";
        errorTitleElement.textContent = "Network Error";
        errorMessageElement.textContent = error.message || "Could not connect to the server. Please try again.";
        errorPopup.style.display = "flex";
    } finally {
        if (errorPopup.style.display === 'flex') {
            overlay.style.display = 'flex';
        }
    }
}

      
document.addEventListener('DOMContentLoaded', () => {
    
    initializeApp();
    handleOAuthRedirects();

    const addNewButton = document.getElementById('addNewButton');
    const uploadChoicePopup = document.getElementById('upload-choice-popup');
    const uploadFilesButton = document.getElementById('uploadFilesButton');
    const uploadFolderButton = document.getElementById('uploadFolderButton');
    const cancelChoiceButton = document.getElementById('cancel-choice-button');
    const fileInputElement = document.getElementById('fileInput');
    const folderInputElement = document.getElementById('folderInput');

   
    let isAwaitingFileSelection = false;


    document.addEventListener("visibilitychange", () => {
       
        if (document.visibilityState === "visible" && isAwaitingFileSelection) {
           
            isAwaitingFileSelection = false;
            
            
            setTimeout(() => {
                if (fileInputElement.files.length === 0 && folderInputElement.files.length === 0) {
                    console.log("Dialog was cancelled, closing overlay.");
                    closeAndResetPopups();
                }
            }, 100); 
        }
    });



    addNewButton.addEventListener('click', () => {
        overlay.style.display = 'flex';
        uploadChoicePopup.style.display = 'flex';
        uploadChoicePopup.classList.add('active-popup');
    });

    
    uploadFilesButton.addEventListener('click', () => {
        uploadChoicePopup.style.display = 'none';
        uploadChoicePopup.classList.remove('active-popup');
        isAwaitingFileSelection = true; 
        fileInputElement.click();       
    });

    
    uploadFolderButton.addEventListener('click', () => {
        uploadChoicePopup.style.display = 'none';
        uploadChoicePopup.classList.remove('active-popup');
        isAwaitingFileSelection = true; 
        folderInputElement.click();       
    });

    
    cancelChoiceButton.addEventListener('click', () => {
        closeAndResetPopups();
    });

   
    fileInputElement.addEventListener('change', (event) => {
       
        isAwaitingFileSelection = false;
        if (event.target.files.length > 0) {
            filesToUpload = [...event.target.files];
            showProviderSelection();
            fileInputElement.value = '';
        }
    });

   
    folderInputElement.addEventListener('change', (event) => {
        
        isAwaitingFileSelection = false;
        if (event.target.files.length > 0) {
            filesToUpload = [...event.target.files];
            showProviderSelection();
            folderInputElement.value = '';
        }
    });
    
    function showProviderSelection() {
       
        uploadProviderPopup.style.display = 'flex';
        uploadProviderPopup.classList.add('active-popup');
    }
});


function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


function initializeApp() {
    checkLoginStatus(); 
    
    fetch('/api/cloud-files')
        .then(res => res.json())
        .then(data => {
            console.log('Cloud files response:', data);
            if (!Array.isArray(data)) {
                
                console.error('Expected an array of files but got:', data);
                return;
            }
            
            data.forEach(file => addFileToList(file)); 
        })
        .catch(err => console.error('Failed to load initial cloud files:', err));
		
	fetchAndDisplayStorageInfo();

}

async function fetchAndDisplayStorageInfo() {
    try {
        const response = await fetch('/api/storage-details', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch storage details');
        }

        const data = await response.json();

        let totalUsedBytes = 0;
        let totalAvailableBytes = 0;
        
        for (const providerKey in data) {
            const providerData = data[providerKey];
            
           
            updateProviderUI(providerKey, providerData);

         
            if (providerData && providerData.total !== undefined) {
                totalUsedBytes += providerData.used;
                totalAvailableBytes += providerData.total;
            }
        }

        updateStorageDonutChart(totalUsedBytes, totalAvailableBytes);

    } catch (error) {
        console.error("Error fetching storage info:", error);
       
        updateProviderUI('google', null);
        updateProviderUI('onedrive', null);
        updateProviderUI('dropbox', null);
    }
}


function updateProviderUI(providerName, data) {
   
    const bar = document.querySelector(`#${providerName}-bar-fill`);
    const fileCountEl = document.querySelector(`#${providerName}-item-count`);
    const spaceEl = document.querySelector(`#${providerName}-space`);

    if (!bar || !fileCountEl || !spaceEl) return;

   
    if (!data || data.total === undefined) {
        bar.style.width = '0%';
        fileCountEl.textContent = `${data ? data.fileCount : 0} items`;
        spaceEl.textContent = 'Disconnected';
        return;
    }

   
    const percent = data.total > 0 ? (data.used / data.total) * 100 : 0;
    bar.style.width = `${percent.toFixed(2)}%`;
    fileCountEl.textContent = `${data.fileCount} items`;
    spaceEl.textContent = `${formatFileSize(data.used)} / ${formatFileSize(data.total)}`;
}

function updateStorageDonutChart(usedBytes, totalBytes) {
    
    const chartElement = document.querySelector('.donut-chart');
    const amountTextElement = document.querySelector('.donut-chart-text .amount');
    const totalTextElement = document.querySelector('.donut-chart-text .total');

   
    if (!chartElement || !amountTextElement || !totalTextElement) {
        console.error('Could not find all donut chart elements.');
        return;
    }

    
    if (totalBytes === 0) {
        amountTextElement.textContent = '0 GB';
        totalTextElement.textContent = 'of 0 GB';
        chartElement.style.background = `conic-gradient(#b394f9 0% 100%)`;
        return;
    }

    
    const usedPercent = (usedBytes / totalBytes) * 100;

    
    chartElement.style.background = `conic-gradient(
        #8B5CF6 0% ${usedPercent.toFixed(2)}%, 
        #b394f9 ${usedPercent.toFixed(2)}% 100%
    )`;

  
    amountTextElement.textContent = formatFileSize(usedBytes);
    totalTextElement.textContent = `of ${formatFileSize(totalBytes)}`;
}




function addFileToList(item) {
    const filesContainer = document.querySelector('.files-list');
    const template = document.getElementById('file-item-template');
    if (!filesContainer || !template) return;

    const newItem = template.cloneNode(true);
    newItem.style.display = '';
    newItem.id = '';

    const nameSpan = newItem.querySelector('.file-name');
    const providerImage = newItem.querySelector('.provider-image');

    switch (item.provider) {
        case 'google':
            providerImage.src = "./Dashboard_assets/google.png";
            providerImage.alt = "Google Drive";
            break;
        case 'onedrive':
            providerImage.src = "./Dashboard_assets/onedrive.png";
            providerImage.alt = "OneDrive";
            break;
        case 'dropbox':
            providerImage.src = "./Dashboard_assets/dropbox.png";
            providerImage.alt = "Dropbox";
            break;
        default:
            providerImage.src = "";
            providerImage.alt = "error";
            break;
    }
    providerImage.style.height = "30px";
    providerImage.style.width = "30px";
    providerImage.style.marginRight = "10px";

    const sizeValueSpan = newItem.querySelector('.file-size-value');
    const select = newItem.querySelector('.custom-select');

    
    nameSpan.textContent = item.file_name;
    sizeValueSpan.textContent = formatFileSize(item.file_size);

    
    select.innerHTML = '';
    const optionDefault = new Option('...', '');
    optionDefault.disabled = true;
    optionDefault.selected = true;
    select.appendChild(optionDefault);

    
    const iconSpan = document.createElement('span');
    iconSpan.className = item.item_type === 'folder' ? 'item-icon icon-folder' : 'item-icon icon-file';
    nameSpan.prepend(iconSpan);

   
    const optionDownload = new Option('Download' + (item.item_type === 'folder' ? ' (.zip)' : ''), 'download');
    const optionDelete = new Option('Delete', 'delete');
    select.appendChild(optionDownload);
    select.appendChild(optionDelete);

    select.addEventListener('change', (e) => {
        const action = e.target.value;
        if (action === 'download') {
            const downloadName = item.item_type === 'folder' ? `${item.file_name}.zip` : item.file_name;
            downloadFile(item.provider, item.file_id, downloadName);
        } else if (action === 'delete') {
            deleteFile(newItem, item.provider, item.file_id);
        }
        select.value = '';
    });

    filesContainer.appendChild(newItem);
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

//!start
async function downloadFile(provider, fileId, fileName) {
    try {
        const response = await fetch(`/api/download/${provider}/${encodeURIComponent(fileId)}`, {
            method: 'GET',
            credentials: 'include' 
        });

        if (!response.ok) {
            
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.message || `Download failed with status: ${response.status}`;
            throw new Error(errorMessage);
        }

        
        const blob = await response.blob();
        
     
        const url = window.URL.createObjectURL(blob);
        
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName; 
        
        document.body.appendChild(a);
        a.click();
        
       
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (err) {
        console.error('Error downloading file:', err);
       
        alert('Could not download the file: ' + err.message);
    }
}


async function deleteFile(elementToRemove, provider, fileId) {
    const fileName = elementToRemove.querySelector('.file-name').textContent;
    
    if (!confirm(`Are you sure you want to permanently delete "${fileName}"? This cannot be undone.`)) {
        const select = elementToRemove.querySelector('.custom-select');
        if (select) select.value = '';
        return;
    }

    overlay.style.display = 'flex';
    closeAndResetPopups(); 

    try {
        const response = await fetch(`/api/delete/${provider}/${encodeURIComponent(fileId)}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to delete the item.');
        }

        elementToRemove.remove();
        successTitleElement.textContent = "Deleted!";
        successMessageElement.textContent = `"${fileName}" was successfully deleted.`;
        successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
        };
        successPopup.style.display = 'flex';
        successPopup.classList.add('active-popup');
        overlay.style.display = 'flex';
    } 
	catch (err) {
        console.error('Error deleting file:', err);
        errorTitleElement.textContent = "Delete Failed";
        errorMessageElement.textContent = err.message;
        errorTryAgainButton.textContent = "Ok";
        errorTryAgainButton.onclick = closeOverlay;
        errorPopup.style.display = 'flex';
        errorPopup.classList.add('active-popup');
        overlay.style.display = 'flex';
    }
}


async function redirectToDropbox() {
    console.log("Initiating Dropbox login...");

   
    let logged = false;
    try {
        const statusResponse = await fetch('/api/dropbox/logged', {
            method: 'GET',
            credentials: 'include'
        });

        const statusData = await statusResponse.json();
        if(statusData.authorized) {
            console.error("User is already logged in!");
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "You are already logged in!";
            errorPopup.style.display = "flex";
            overlay.style.display = "flex";
            logged=true;
        }
            
    } catch(error) {
            console.error("Error getting login status:", error);
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error receiving login status: " + error;
            errorPopup.style.display = "flex";
            overlay.style.display = "flex";
        }

    if(logged ===false) {
  
    const state = 'dropbox-' + Date.now();
    
    
    const dropboxUrl = `https://www.dropbox.com/oauth2/authorize?` +
        `client_id=ew23aw4zu2gogc9` +       
        `&response_type=code` +
        `&token_access_type=offline` +
        `&redirect_uri=http://localhost:8082/dashboard` +
        `&state=${state}`;

    
    window.location.href = dropboxUrl;
    }
}

async function redirectToOneDrive() {
    console.log("Initiating OneDrive login...");

  
    let logged = false;
    try {
        const statusResponse = await fetch('/api/onedrive/logged', {
            method: 'GET',
            credentials: 'include'
        });

        const statusData = await statusResponse.json();
        if(statusData.authorized) {
            console.error("User is already logged in!");
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "You are already logged in!";
            errorPopup.style.display = "flex";
            overlay.style.display = "flex";
            logged=true;
        }
            
    } catch(error) {
            console.error("Error getting login status:", error);
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error receiving login status: " + error;
            errorPopup.style.display = "flex";
            overlay.style.display = "flex";
        }

    if(logged ===false) {
  
    const state = 'onedrive-' + Date.now();


    const onedriveUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=8e21fb46-bfa1-4869-a7e0-e8ab84a55eac` +      
        `&scope=files.readwrite.all%20offline_access%20user.read` +
        `&response_type=code` +
        `&redirect_uri=http://localhost:8082/dashboard` +
        `&state=${state}`;

    
    window.location.href = onedriveUrl;
    }
}



function handleOAuthRedirects() {
    const code = getQueryParam('code');
    const state = getQueryParam('state');

    
    if (!code || !state) {
        return;
    }

    
    if (state.startsWith('dropbox-')) {
        console.log("Detected a redirect from Dropbox.");
        processDropboxLogin(code, state);

    } else if (state.startsWith('onedrive-')) {
        console.log("Detected a redirect from OneDrive.");
        processOneDriveLogin(code, state);

    } else {
        console.error("Unknown OAuth state received:", state);
        
        window.history.replaceState({}, document.title, "/dashboard");
    }
}


function processDropboxLogin(code, state) {
    fetch(`/api/dropbox/login?code=${code}`, {
        method: 'POST',
		credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        window.history.replaceState({}, document.title, "/dashboard");
        if (data.success) {
            console.log('Dropbox connected successfully!');
            
            successTitleElement.textContent = "Success!";
            successCompletedButton.textContent = "Ok";
            successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
            };
            successMessageElement.textContent = "Successfully logged in!";
            successPopup.style.display = "flex";
            overlay.style.display = 'flex';
        } else {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error: " + data.message;
            errorPopup.style.display = "flex";
            overlay.style.display = 'flex';
            console.error('Error connecting Dropbox:', data.message || JSON.stringify(data));
        }
    })
    .catch(err => {
        window.history.replaceState({}, document.title, "/dashboard");
        console.error('A network or server error occurred during Dropbox login:', err);
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error: " + err;
            errorPopup.style.display = "flex";
            overlay.style.display = 'flex';
    });
}

function processOneDriveLogin(code, state) {
    fetch(`/api/onedrive/login?code=${code}`, {
        method: 'POST',
		credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        window.history.replaceState({}, document.title, "/dashboard");
        if (data.success) {
            console.log('OneDrive connected successfully!');
            
            successTitleElement.textContent = "Success!";
            successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
            };
            successCompletedButton.addEventListener("click",closeOverlay);
            successMessageElement.textContent = "Successfully logged in!";
            successPopup.style.display = "flex";
            overlay.style.display = 'flex';
        } else {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error: " + data.message;
            errorPopup.style.display = "flex";
            overlay.style.display = 'flex';
            console.error('Error connecting OneDrive:', data.message);
        }
    })
    .catch(err => {
        window.history.replaceState({}, document.title, "/dashboard");
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error: " + err;
            errorPopup.style.display = "flex";
            overlay.style.display = 'flex';
        console.error('A network or server error occurred during OneDrive login:', err);
    });
}

    

async function returnL() {
  window.location.href='/login'
}

async function handleAuthClick() {
  
  errorTryAgainButton.onclick = closeOverlay();

  
    let logged = false;
    try {
        const statusResponse = await fetch('/api/google/logged', {
            method: 'GET',
            credentials: 'include'
        });

        const statusData = await statusResponse.json();
        if(statusData.authorized) {
            console.error("User is already logged in!");
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "You are already logged in!";
            errorPopup.style.display = "flex";
            overlay.style.display = "flex";
            logged=true;
        }
            
    } catch(error) {
            console.error("Error getting login status:", error);
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error receiving login status: " + error;
            errorPopup.style.display = "flex";
            overlay.style.display = "flex";
        }

    if(logged === false) {
   

    const client = google.accounts.oauth2.initCodeClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    ux_mode: 'popup',
    redirect_uri: 'postmessage', 
    callback: async (response) => {
      const code = response.code;

      if (code) {
        console.log("SUCCESS: Received authorization code via postmessage:", code);

        try {
          const res = await fetch(`http://localhost:8082/api/google/login?code=${code}`, {
            method: "POST",
            credentials: 'include',
            headers: {
              "Content-Type": "application/json"
            },
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: "Unknown error." }));
            throw new Error(errorData.message);
          }

          const data = await res.json();
          console.log("Backend connection response:", data);
          
            successTitleElement.textContent = "Success!";
            successCompletedButton.textContent = "Ok";
            successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
            };
            successMessageElement.textContent = "Successfully logged in!";
            successPopup.style.display = "flex";

        } catch (error) {
          console.error("Error sending code to backend:", error);
         
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error sending code to backend: " + error;
            errorPopup.style.display = "flex";
        }

      } else {
        console.error("Error: Did not receive authorization code from Google.", response);
       
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error receiving authorization code from Google: " + response;
            errorPopup.style.display = "flex";
      }
    
      if (successPopup.style.display === 'flex' || errorPopup.style.display === 'flex')
        overlay.style.display = 'flex';
    },
  });

  client.requestCode();
    }
}


async function updateGoogle() {
  try {
        const response = await fetch('http://localhost:8082/api/ceva', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Success recieving Google Drive data!");
            googleStorageBar.style.width='10%';
            googleFileCount.textContent='placeholderSuccess';
            googleSpace.textContent='placeholderSuccess';
        } else {
          console.log("Error recieving Google Drive data!");
            googleStorageBar.style.width='90%';
            googleFileCount.textContent='placeholderFail';
            googleSpace.textContent='placeholderFail';
        }
    } catch (error) {
        console.error("Error checking Google Drive info: ", error);
            googleStorageBar.style.width='50%';
            googleFileCount.textContent='placeholderError';
            googleSpace.textContent='placeholderError';
    }
}



providerButtons.forEach(button => {
    button.addEventListener('click', () => {
        const provider = button.dataset.provider;
        if (filesToUpload && provider) {
            
            initiateUpload(provider, filesToUpload);
        }
    });
});


cancelUploadButton.addEventListener('click', () => {
    filesToUpload = null; 
    closeAndResetPopups();
});

async function initiateUpload(provider, files) {
   
    uploadProviderPopup.style.display = 'none';
    uploadProviderPopup.classList.remove('active-popup');
    
   
    overlay.style.display = 'flex'; 

    console.log(`Starting upload process for ${provider}...`);
    
    const showError = (title, message) => {
        errorTitleElement.textContent = title;
        errorMessageElement.textContent = message;
        errorTryAgainButton.textContent = "Ok";
        errorTryAgainButton.onclick = closeOverlay;
        errorPopup.style.display = 'flex';
        errorPopup.classList.add('active-popup');
        overlay.style.display = 'flex'; 
    };

    try {
        
        const statusResponse = await fetch(`/api/${provider}/logged`, {
            method: 'GET',
            credentials: 'include'
        });
        const statusData = await statusResponse.json();

        if (!statusData.authorized) {
            const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
            showError("Not Connected", `You are not logged in to ${providerName}. Please connect your account first.`);
            return;
        }

       
        console.log(`User is connected to ${provider}. Proceeding with file upload.`);
        const formData = new FormData();
        for (let file of files) {
            const uploadPath = file.webkitRelativePath || file.name;
            formData.append('files', file, uploadPath);
        }

        const response = await fetch(`/api/upload?provider=${provider}`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Upload failed');
        }

        const result = await response.json();
        const successProviderName = provider.charAt(0).toUpperCase() + provider.slice(1);
        
        
        successTitleElement.textContent = "Upload Complete";
        successMessageElement.textContent = `Successfully uploaded files to ${successProviderName}.`;
        successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
        };
        successPopup.style.display = 'flex';
        successPopup.classList.add('active-popup');
       
    } 
	catch (error) {
        console.error('Error during upload process:', error);
        
        showError("Upload Failed", error.message);
    } finally {
        filesToUpload = null; 
    }
}


function closeAndResetPopups() {
    overlay.style.display = 'none';
    uploadProviderPopup.style.display = 'none';
    successPopup.style.display = 'none';
    errorPopup.style.display = 'none';
    
    document.querySelectorAll('#response-overlay > div').forEach(p => p.classList.remove('active-popup'));
}


async function closeOverlay() {
  closeAndResetPopups();
}

  function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}



async function updateFile() {
  try {
        const response = await fetch('http://localhost:8082/api/ceva', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Success recieving file data!");
            fileName.textContent='placeholderSuccess';
            fileSize.textContent='placeholderSuccess';
        } else {
          console.log("Error recieving file data!");
            fileName.textContent='placeholderFail';
            fileSize.textContent='placeholderFail';
        }
    } catch (error) {
        console.error("Error checking file info: ", error);
            fileName.textContent='placeholderError';
            fileSize.textContent='placeholderError';
    }
}


async function logout() {
  try {
        const response = await fetch('http://localhost:8082/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        errorTryAgainButton.onclick=closeOverlay();
        if (response.ok) {
            const data = await response.json();
            window.location.href='/login'
        } else {
          console.log("Error log out!");
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = errorDataFromServer.message || "Can't log out " + response.status;
            errorPopup.style.display = "flex";
        }
    } catch (error) {
        console.error("Network Error ", error);
        errorTitleElement.textContent = "Network Error";
        errorTryAgainButton.textContent = "Ok";
        errorTryAgainButton.addEventListener("click",closeOverlay);
        errorMessageElement.textContent = error.message || "Could not connect to the server. Please try again.";
        errorPopup.style.display = "flex";
    } finally {
        if (errorPopup.style.display === 'flex') {
            overlay.style.display = 'flex';
        }
    }
}

async function closeOverlay() {
  overlay.style.display='none';
  errorPopup.style.display='none';
  successPopup.style.display = 'none';
}

async function updateGraph() {
  const chartAmount = document.querySelector('.donut-chart-text .amount');
  const chartTotal = document.querySelector('.donut-chart-text .total');
  const chart = document.querySelector('.donut-chart');
  try {
        const response = await fetch('http://localhost:8082/api/ceva', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Success recieving chart data!");
            const usedPercent = (data.used / data.total) * 100;
            chart.style.background = `conic-gradient(
          #8B5CF6 0% ${usedPercent}%, 
          #b394f9 ${usedPercent}% 100%
            )`;
            chartAmount.textContent='Ok';
            chartTotal.textContent='of Ok';
        } else {
          console.log("Error recieving chart data!");
            chart.style.background = `conic-gradient(
          #8B5CF6 0% 0%, 
          #b394f9 0% 100%
            )`;
            chartAmount.textContent='Error';
            chartTotal.textContent='of Error';
        }
    } catch (error) {
        console.error("Error checking chart info: ", error);
            chart.style.background = `conic-gradient(
          #8B5CF6 0% 100%, 
          #b394f9 0% 0%
            )`;
            chartAmount.textContent='404 GB';
            chartTotal.textContent='of 404 GB';

    }
}

async function updateOneDrive() {
  try {
        const response = await fetch('http://localhost:8082/api/ceva', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Success recieving One Drive data!");
            onedriveStorageBar.style.width='10%';
            onedriveFileCount.textContent='placeholderSuccess';
            onedriveSpace.textContent='placeholderSuccess';
        } else {
          console.log("Error recieving One Drive data!");
            onedriveStorageBar.style.width='90%';
            onedriveFileCount.textContent='placeholderFail';
            onedriveSpace.textContent='placeholderFail';
        }
    } catch (error) {
        console.error("Error checking One Drive info: ", error);
            onedriveStorageBar.style.width='50%';
            onedriveFileCount.textContent='placeholderError';
            onedriveSpace.textContent='placeholderError';
    }
}

async function updateDropbox() {
  try {
        const response = await fetch('http://localhost:8082/api/ceva', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Success recieving Dropbox data!");
            dropboxStorageBar.style.width='10%';
            dropboxFileCount.textContent='placeholderSuccess';
            dropboxSpace.textContent='placeholderSuccess';
        } else {
          console.log("Error recieving Dropbox data!");
            dropboxStorageBar.style.width='90%';
            dropboxFileCount.textContent='placeholderFail';
            dropboxSpace.textContent='placeholderFail';
        }
    } catch (error) {
        console.error("Error checking Dropbox info: ", error);
            dropboxStorageBar.style.width='50%';
            dropboxFileCount.textContent='placeholderError';
            dropboxSpace.textContent='placeholderError';
    }
}



async function logoutGoogle() {
    console.log("Checking Google Drive login status before logout...");
    try {
       
        const statusResponse = await fetch('/api/google/logged', {
            method: 'GET',
            credentials: 'include'
        });

        if (!statusResponse.ok) {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error: " + statusResponse.statusText;
            errorPopup.style.display = "flex";
            throw new Error(`Could not verify Google login status: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();

        
        if (statusData.authorized) {
            console.log("Google Drive is connected. Proceeding with logout.");
            const logoutResponse = await fetch('/api/google/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (!logoutResponse.ok) {
                const errorData = await logoutResponse.json().catch(() => ({ message: 'Logout failed.' }));
                throw new Error(errorData.message);
            }
            successTitleElement.textContent = "Success!";
            successCompletedButton.textContent = "Ok";
            successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
            };
            successMessageElement.textContent = "Successfully logged out!";
            successPopup.style.display = "flex";
            console.log("Successfully logged out from Google Drive on the backend.");
        } else {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Already disconnected!";
            errorPopup.style.display = "flex";
            console.log("Google Drive is already disconnected. No logout action needed.");
        }

    } catch (error) {
        console.error("Error during Google Drive logout process:", error);
        alert("Failed to log out from Google Drive: " + error.message);
    } finally {
        if (successPopup.style.display === 'flex' || errorPopup.style.display === 'flex')
            overlay.style.display = 'flex';
    }
}


async function logoutOneDrive() {
    console.log("Checking OneDrive login status before logout...");
    try {
     
        const statusResponse = await fetch('/api/onedrive/logged', {
            method: 'GET',
            credentials: 'include'
        });

        if (!statusResponse.ok) {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error: " + statusResponse.statusText;
            errorPopup.style.display = "flex";
            throw new Error(`Could not verify OneDrive login status: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();

        
        if (statusData.authorized) {
            console.log("OneDrive is connected. Proceeding with logout.");
            const logoutResponse = await fetch('/api/onedrive/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (!logoutResponse.ok) {
                const errorData = await logoutResponse.json().catch(() => ({ message: 'Logout failed.' }));
                throw new Error(errorData.message);
            }
            successTitleElement.textContent = "Success!";
            successCompletedButton.textContent = "Ok";
            successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
            };
            successMessageElement.textContent = "Successfully logged out!";
            successPopup.style.display = "flex";
            console.log("Successfully logged out from OneDrive on the backend.");
        } else {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Already disconnected!";
            errorPopup.style.display = "flex";
            console.log("OneDrive is already disconnected. No logout action needed.");
        }

       

    } catch (error) {
        console.error("Error during OneDrive logout process:", error);
        alert("Failed to log out from OneDrive: " + error.message);
    } finally {
        if (successPopup.style.display === 'flex' || errorPopup.style.display === 'flex')
            overlay.style.display = 'flex';
    }
}


async function logoutDropbox() {
    console.log("Checking Dropbox login status before logout...");
    try {
        
        const statusResponse = await fetch('/api/dropbox/logged', {
            method: 'GET',
            credentials: 'include'
        });

        if (!statusResponse.ok) {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Error: " + statusResponse.statusText;
            errorPopup.style.display = "flex";
            throw new Error(`Could not verify Dropbox login status: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();

       
        if (statusData.authorized) {
            console.log("Dropbox is connected. Proceeding with logout.");
            const logoutResponse = await fetch('/api/dropbox/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (!logoutResponse.ok) {
                const errorData = await logoutResponse.json().catch(() => ({ message: 'Logout failed.' }));
                throw new Error(errorData.message);
            }
            successTitleElement.textContent = "Success!";
            successCompletedButton.textContent = "Ok";
            successCompletedButton.onclick = () => {
             closeOverlay();
             window.location.reload(); 
             };
            successMessageElement.textContent = "Successfully logged out!";
            successPopup.style.display = "flex";
            console.log("Successfully logged out from Dropbox on the backend.");
        } else {
            errorTitleElement.textContent = "Error!";
            errorTryAgainButton.textContent = "Ok";
            errorTryAgainButton.addEventListener("click",closeOverlay);
            errorMessageElement.textContent = "Already disconnected!";
            errorPopup.style.display = "flex";
            console.log("Dropbox is already disconnected. No logout action needed.");
        }

     

    } catch (error) {
        console.error("Error during Dropbox logout process:", error);
        alert("Failed to log out from Dropbox: " + error.message);
    } finally {
        if (successPopup.style.display === 'flex' || errorPopup.style.display === 'flex')
            overlay.style.display = 'flex';
    }
}
