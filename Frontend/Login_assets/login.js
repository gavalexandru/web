const overlay = document.getElementById("response-overlay");

const successPopup = document.getElementById("success-popup-content");
const successTitleElement = document.getElementById("success-title");
const successMessageElement = document.getElementById("success-message");
const successCompletedButton = document.getElementById("success-completed-button");

const errorPopup = document.getElementById("error-popup-content");
const errorTitleElement = document.getElementById("error-title");
const errorMessageElement = document.getElementById("error-message");
const errorTryAgainButton = document.getElementById("error-try-again-button");

function hideOverlayAndPopups() {
    overlay.style.display = 'none';
    successPopup.style.display = 'none';
    errorPopup.style.display = 'none';
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
  return emailRegex.test(email);
}

overlay.addEventListener("click", function(event) {
    if (event.target === this) {
        hideOverlayAndPopups();
    }
});
successCompletedButton.addEventListener("click", hideOverlayAndPopups);
errorTryAgainButton.addEventListener("click", hideOverlayAndPopups);


async function login() {
    let email = document.getElementById("email").value;
    let password = document.getElementById("pass").value;
    if (email === "" || email == null) {
        errorTitleElement.textContent = "Validation Error";
        errorMessageElement.textContent = "Please enter your email address.";
        errorPopup.style.display = 'flex';
        overlay.style.display = 'flex';
        return;
    }
    if(!isValidEmail(email)) {
        errorTitleElement.textContent = "Validation Error";
        errorMessageElement.textContent = "Please enter a valid email address.";
        errorPopup.style.display = 'flex';
        overlay.style.display = 'flex';
        return;
    }
    if (password === "" || password == null) {
        errorTitleElement.textContent = "Validation Error";
        errorMessageElement.textContent = "Please enter a password.";
        errorPopup.style.display = 'flex';
        overlay.style.display = 'flex';
        return;
    }

    successPopup.style.display = 'none';
    errorPopup.style.display = 'none';

    try {
        const response = await fetch('http://localhost:8082/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Success:", data);
            successTitleElement.textContent = "Success!";
            successMessageElement.textContent = data.message || "Login successful!";
            successPopup.style.display = "flex";
        } else {
            let errorDataFromServer = { message: "An error occurred. Status: " + response.status };
            try {
                errorDataFromServer = await response.json();
            } catch (jsonParseError) {
                console.warn("Could not parse error JSON from server:", jsonParseError);
                if (response.statusText) {
                    errorDataFromServer.message = response.statusText;
                }
            }
            console.error("Error:", response.status, errorDataFromServer);
            errorTitleElement.textContent = "Login Failed";
            errorMessageElement.textContent = errorDataFromServer.message || "An error occurred: " + response.status;
            errorPopup.style.display = "flex";
        }
    } catch (error) {
        console.error("Fetch error:", error);
        errorTitleElement.textContent = "Network Error";
        errorMessageElement.textContent = error.message || "Could not connect to the server. Please try again.";
        errorPopup.style.display = "flex";
    } finally {
        if (successPopup.style.display === 'flex' || errorPopup.style.display === 'flex') {
            overlay.style.display = 'flex';
        }
    }
}