"use strict";

function interceptRequests(onRequest) {
   let acceptRequests = true;
   const requestWillBeAwaited = {};
   const requestWillBeCompleted = {};
   const requestWillBeCompletedPromises = [];
   const responseWillBeReceived = {};
   const textDecoder = new TextDecoder();

   const onBeforeRequestListener = requestDetails => {
      if (acceptRequests || !!requestWillBeCompleted[requestDetails.requestId]) {
         let responseBody = "";

         const filter = browser.webRequest.filterResponseData(requestDetails.requestId);

         filter.ondata = e => {
            responseBody += textDecoder.decode(e.data, { stream: true });
            filter.write(e.data);
         };

         filter.onerror = () => {
            // NOTE: don't worry if a "Channel redirected" error occurs
            console.log("!!! filter error: ", filter.error);
         };

         filter.onstop = () => {
            filter.disconnect();
         };

         if (!requestWillBeCompleted[requestDetails.requestId]) {
            requestWillBeCompleted[requestDetails.requestId] = createDeferred();
            requestWillBeCompletedPromises.push(requestWillBeCompleted[requestDetails.requestId].promise);
         }
         responseWillBeReceived[requestDetails.requestId] = createDeferred();

         responseWillBeReceived[requestDetails.requestId].promise.then(responseData => {
            onRequest({
               requestDetails: requestDetails,
               responseDetails: responseData.responseDetails,
               responseBody: responseBody
            });
            if (responseData.status == "completed") {
               requestWillBeCompleted[requestDetails.requestId].resolve();
            }
         }).catch(error => {
            console.error(error);
            requestWillBeCompleted[requestDetails.requestId].resolve();
         });
      }
   };

   const onBeforeSendHeadersListener = requestDetails => {
      const waitIdHeader = requestDetails.requestHeaders.find(
         header => header.name.toLowerCase() == 'x-mitch-waitid'
      );
      if (waitIdHeader != null) {
         if (!!requestWillBeAwaited[waitIdHeader.value]) {
            requestWillBeAwaited[waitIdHeader.value].resolve();
         }
         requestDetails.requestHeaders = requestDetails.requestHeaders.filter(
            header => header.name.toLowerCase() != 'x-mitch-waitid'
         );
      }
      return {
         requestHeaders: requestDetails.requestHeaders
      };
   };

   const onBeforeRedirectListener = responseDetails => {
      if (!!responseWillBeReceived[responseDetails.requestId]) {
         responseWillBeReceived[responseDetails.requestId].resolve({ status: "redirect", responseDetails: responseDetails });
      }
   };

   const onCompletedListener = responseDetails => {
      if (!!responseWillBeReceived[responseDetails.requestId]) {
         responseWillBeReceived[responseDetails.requestId].resolve({ status: "completed", responseDetails: responseDetails });
      }
   };

   const onErrorOccurredListener = errorDetails => {
      if (!!responseWillBeReceived[errorDetails.requestId]) {
         responseWillBeReceived[errorDetails.requestId].reject(`!!! request error (${errorDetails.url}): ${errorDetails.error}`);
      }
   }

   const filter = { urls: ["<all_urls>"], types: ["main_frame", "xmlhttprequest", "sub_frame", "other"] };
   chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestListener, filter, ["blocking", "requestBody"]);
   chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeadersListener, filter, ["blocking", "requestHeaders"]);
   chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirectListener, filter, ["responseHeaders"]);
   chrome.webRequest.onCompleted.addListener(onCompletedListener, filter, ["responseHeaders"]);
   chrome.webRequest.onErrorOccurred.addListener(onErrorOccurredListener, filter);

   return {
      stop: async () => {
         acceptRequests = false;
         await Promise.all(requestWillBeCompletedPromises);
         chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequestListener);
         chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeadersListener);
         chrome.webRequest.onBeforeRedirect.removeListener(onBeforeRedirectListener);
         chrome.webRequest.onCompleted.removeListener(onCompletedListener);
         chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurredListener);
      },
      requireWaitId: () => {
         const waitId = "" + performance.now();
         requestWillBeAwaited[waitId] = createDeferred();
         return waitId;
      },
      waitRequest: async waitId => {
         await requestWillBeAwaited[waitId].promise;
      }
   };

   function createDeferred() {
      let resolve, reject;
      const promise = new Promise((_resolve, _reject) => {
         resolve = _resolve;
         reject = _reject;
      });
      return {
         resolve: resolve,
         reject: reject,
         promise: promise
      };
   }
}