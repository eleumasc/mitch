'use strict';

window.addEventListener("mitchrequest", e => {
   const mRequest = JSON.parse(e.detail);
   chrome.runtime.sendMessage({
      type: mRequest.type,
      data: JSON.parse(mRequest.dataJson)
   }, mReplyData => {
      window.dispatchEvent(
         new CustomEvent("mitchreply." + mRequest.id, {
            detail: JSON.stringify({
               id: mRequest.id,
               dataJson: JSON.stringify(mReplyData)
            })
         })
      );
   });
});