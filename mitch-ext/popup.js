'use strict';

function callAndWait(bp, f) {
   return async () => {
      bp.busy = true;
      updatePopup(bp);
      await f();
      bp.busy = false;
      updatePopup(bp);
   };
}

function updatePopup(bp) {
   document.getElementById('main_button').style.display = "initial";
   if (bp.busy) {
      document.getElementById('message').innerHTML = "please wait...";
		document.getElementById('main_button').style.display = "none";
   } else if (bp.phase == 0) {
		document.getElementById('sensitive_requests').innerHTML = bp.collected_sensitive_requests;
      document.getElementById('total_requests').innerHTML = bp.collected_total_requests;
		document.getElementById('main_button').addEventListener('click', callAndWait(bp, bp.finished_Alice1));
	} else if (bp.phase == 1) {
		document.getElementById('message').innerHTML = "please logout from the current session and press the button";
      document.getElementById('main_button').value = "I logged out, continue...";
		document.getElementById('main_button').addEventListener('click', callAndWait(bp, bp.logged_out_Alice1));
	} else if (bp.phase == 2) {
		document.getElementById('message').innerHTML = "please login as a different user and press the button";
      document.getElementById('main_button').value = "I logged in, continue...";
		document.getElementById('main_button').addEventListener('click', callAndWait(bp, bp.logged_in_Bob));
	} else if (bp.phase == 3) {
		document.getElementById('message').innerHTML = "please logout from the current session and press the button";
      document.getElementById('main_button').value = "I logged out, continue...";
		document.getElementById('main_button').addEventListener('click', callAndWait(bp, bp.logged_out_Bob));
	} else if (bp.phase == 4) {
		document.getElementById('message').innerHTML = "please login again as the first user and press the button";
      document.getElementById('main_button').value = "I logged in, continue...";
		document.getElementById('main_button').addEventListener('click', callAndWait(bp, bp.logged_in_Alice2));
	} else if (bp.phase == 5) {
		document.getElementById('message').innerHTML = "please logout from the current session and press the button";
      document.getElementById('main_button').value = "I logged out, continue...";
		document.getElementById('main_button').addEventListener('click', callAndWait(bp, bp.logged_out_Alice2));
	} else if (bp.phase == 6) {
		document.getElementById('message').innerHTML = "ok, all should have been done";
      	document.getElementById('main_button').value = "draw conclusions";
		document.getElementById('main_button').addEventListener('click', async () => { await callAndWait(bp, bp.make_conclusions)(); window.close(); });
	} else {
		document.getElementById('message').innerHTML = "thank you for playing";
		document.getElementById('main_button').style.display = "none";
	}
}

// getting the background page to access the data array
browser.runtime.getBackgroundPage().then( function (bp) {
   updatePopup(bp);
});