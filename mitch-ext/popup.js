'use strict';

function callAndWait(bp, fn) {
   return async () => {
      bp.busy = true;
      updatePopup(bp);
      await fn();
      bp.busy = false;
      updatePopup(bp);
   };
}

function updatePopup(bp) {
   const messageElement = document.getElementById('message');
   const buttonElement = document.getElementById('main_button');

   buttonElement.style.display = "initial";

   if (bp.busy) {
      messageElement.textContent = "please wait... don't close the popup";
      buttonElement.style.display = "none";
   } else if (bp.phase == -1) {
      messageElement.textContent = "welcome to Mitch!";
      buttonElement.textContent = "Let's start!";
      buttonElement.addEventListener('click', callAndWait(bp, bp.start_Alice1));
   } else if (bp.phase == 0) {
      messageElement.textContent = `Collecting sensitive requests: ${bp.collected_sensitive_requests}/${bp.collected_total_requests}`
      buttonElement.textContent = "I finished Alice run, continue...";
      buttonElement.addEventListener('click', callAndWait(bp, bp.finished_Alice1));
   } else if (bp.phase == 1) {
      messageElement.textContent = "please logout from the current session and press the button";
      buttonElement.textContent = "I logged out, continue...";
      buttonElement.addEventListener('click', callAndWait(bp, bp.logged_out_Alice1));
   } else if (bp.phase == 2) {
      messageElement.textContent = "please login as a different user and press the button";
      buttonElement.textContent = "I logged in, continue...";
      buttonElement.addEventListener('click', callAndWait(bp, bp.logged_in_Bob));
   } else if (bp.phase == 3) {
      messageElement.textContent = "please logout from the current session and press the button";
      buttonElement.textContent = "I logged out, continue...";
      buttonElement.addEventListener('click', callAndWait(bp, bp.logged_out_Bob));
   } else if (bp.phase == 4) {
      messageElement.textContent = "please login again as the first user and press the button";
      buttonElement.textContent = "I logged in, continue...";
      buttonElement.addEventListener('click', callAndWait(bp, bp.logged_in_Alice2));
   } else if (bp.phase == 5) {
      messageElement.textContent = "please logout from the current session and press the button";
      buttonElement.textContent = "I logged out, continue...";
      buttonElement.addEventListener('click', callAndWait(bp, bp.logged_out_Alice2));
   } else if (bp.phase == 6) {
      messageElement.textContent = "ok, all should have been done";
      buttonElement.textContent = "draw conclusions";
      buttonElement.addEventListener('click', callAndWait(bp, bp.make_conclusions));
   } else {
      messageElement.textContent = "thank you for playing";
      buttonElement.style.display = "none";
   }
}

browser.runtime.getBackgroundPage().then(bp => {
   updatePopup(bp);
});