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
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const GOOGLE_DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

const dropbox_clientId = 'ew23aw4zu2gogc9';
const dropbox_redirectUri = 'http://localhost/Frontend//dashboard'; 
const dropbox_state = generateRandomState();
localStorage.setItem('oauth_state', dropbox_state);
const dropbox_authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${dropbox_clientId}&redirect_uri=${encodeURIComponent(dropbox_redirectUri)}&state=${dropbox_state}`;

  selectElement.addEventListener('change', () => {
      alert(selectElement.value);
  });

    selectGoogleElement.addEventListener('change', () => {
      if(selectGoogleElement.value==="Logging in - Google Drive")
        handleAuthClick();
        else
      alert(selectGoogleElement.value);
  });

    selectOneDriveElement.addEventListener('change', () => {
      alert(selectOneDriveElement.value);
  });

    selectDropboxElement.addEventListener('change', () => {
      if(selectDropboxElement.value==="Logging in - Dropbox")
        window.location.href = dropbox_authUrl;
        else
      alert(selectDropboxElement.value);
  });

  function generateRandomState(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = '';
  for (let i = 0; i < length; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}

function getQueryParam(param) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param);
    }

async function checkLoginStatus() {
    try {
        const response = await fetch('http://localhost:8082/api/logged', {
            method: 'POST',
            credentials: 'include'
        });
        errorTryAgainButton.onclick = null;
        if (response.ok) {
            const data = await response.json();
            console.log("Logged in as:", data);
        } else {
            console.log("Not logged in");
            errorTryAgainButton.addEventListener("click",returnL);
            errorTryAgainButton.textContent="Return to Login";
            errorTitleElement.textContent = "Not Logged in";
            errorMessageElement.textContent = errorDataFromServer.message || "You aren't logged in " + response.status;
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
    checkLoginStatus();

const code = getQueryParam('code');
const returnedState = getQueryParam('state');
const storedState = localStorage.getItem('oauth_state');

if (code) {
      if (returnedState !== storedState) {
        console.log('State mismatch! Possible CSRF attack.');
      } else {
        console.log('Got authorization code! Exchanging for access token...');

        fetch('/api/dropbox/exchange-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            console.log('Dropbox connected successfully!');
            console.log('Dropbox token:', data.access_token);
          } else {
            console.log('Error: ' + JSON.stringify(data));
          }
        })
        .catch(err => {
          console.error(err);
          console.log('Error exchanging code.');
        });
      }
    }
});

async function returnL() {
  window.location.href='/login'
}

function handleAuthClick() {
  google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (response) => {
      if (response.access_token) {
        console.log("Access Token:", response.access_token);
        listDriveFiles(response.access_token);
      } else {
        console.error("Error retrieving access token:", response);
      }
    },
  }).requestAccessToken();
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

document.getElementById('fileInput').addEventListener('change', function(event) {
    const files = event.target.files;
    console.log('Selected files:', files);
  });

async function logout() {
  try {
        const response = await fetch('http://localhost:8082/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        errorTryAgainButton.onclick=null;
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