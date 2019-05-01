'use strict';

chrome.runtime.sendMessage({ type: "tellCSRFs" }, replyData => {
   document.getElementById('message').innerHTML = replyData;
});