"use strict";

var busy                         = false;
var sensitive_requests           = [];       // this will be Alice's first run
var phase                        = -1;       // see from line ~160 for the various phases
var collected_sensitive_requests = 0;
var collected_total_requests     = 0;
var bob_requests                 = [];
var alice1_requests              = [];
var unauth_requests              = [];

var active_collector;
var request_interceptor;

var classifier = new RandomForestClassifier();


// Ignores some requests which are certainly not HTTP and requests to third-parties
function goodUrl(u, s) {
   if (!u.protocol.startsWith("http"))
      return false;

   if (u.pathname.endsWith("/chrome/newtab"))
      return false;

   const tokens = s.hostname.split(".");
   const domain = tokens[tokens.length - 2];

   if (!u.host.includes(domain))
      return false;

   return true;
}

// Extracts the parameters from a query string (for GET requests)
function extractParams(urlSearchParams) {
   return Array.from(urlSearchParams.keys()).reduce((acc, cur) => {
      acc[cur] = urlSearchParams.getAll(cur);
      return acc;
   }, {});
}

// Checks the number and the names of all the parameters of HTTP requests params1 and params2
function sameParams(params1, params2) {
   const keys1 = Object.keys(params1), keys2 = Object.keys(params2);
   return (keys1.length == keys2.length && keys1.every(k => keys2.includes(k)));
}

function sameRequest(request1, request2) {
   return request1.method == request2.method && request1.url == request2.url && sameParams(request1.params, request2.params);
}

// Checks whether request is already in requestsArray (up to sameParams)
function isKnown(request, requestsArray) {
   return requestsArray.some(request1 => sameRequest(request, request1));
}

function parseRequest(requestData) {
   const url = new URL(requestData.requestDetails.url);

   const params = extractParams(new URLSearchParams(url.search));
   let postBody = "";
   let isJson = false;

   if (requestData.requestDetails.method != "GET" && !!requestData.requestDetails.requestBody) {
      if (!!requestData.requestDetails.requestBody.formData) {
         Object.assign(params, requestData.requestDetails.requestBody.formData);
      }

      if (!!requestData.requestDetails.requestBody.raw) {
         postBody = requestData.requestDetails.requestBody.raw.map(
            data => String.fromCharCode.apply(null, new Uint8Array(data.bytes))
         ).join('');
         try {
            const jsonData = JSON.parse(postBody);
            isJson = true;
            for (let key in jsonData) {
               params[key] = JSON.stringify(jsonData[key]);
            }
         } catch {
            console.log("!!! Unknown request body format");
            Object.assign(params, extractParams(new URLSearchParams("?" + decodeURIComponent(postBody))));
         }
      }
   }

   return {
      reqId: requestData.requestDetails.requestId,
      method: requestData.requestDetails.method,
      url: url.protocol + "//" + url.hostname + url.pathname,
      params: params,
      isJson: isJson,
      postBody: postBody,
      response: {
         body: requestData.responseBody,
         status: requestData.responseDetails.statusCode,
         headers: requestData.responseDetails.responseHeaders.reduce((acc, cur) => {
            acc[cur.name] = cur.value;
            return acc;
         }, {})
      }
   };
}

function requestHandler(requestData) {
   if (phase == 0) {
      const url = new URL(requestData.requestDetails.url);
      const pageUrl = new URL(requestData.requestDetails.originUrl || requestData.requestDetails.url);
      if (goodUrl(url, pageUrl)) {
         const request = parseRequest(requestData);
         console.log(request);
         if (isSensitive(request) && !isKnown(request, active_collector)) {
            active_collector.push(request);
            collected_sensitive_requests++;
         }
         collected_total_requests++;
      }
   } else {
      const request = parseRequest(requestData);
      active_collector.push(request);
   }
}

async function replayRequests(requestsArray) {
   for (let request of requestsArray) {
      const async = true;
      const xhr = new XMLHttpRequest();

      if (request["method"].toUpperCase() != "GET" && request["method"].toUpperCase() != "POST") {
         console.log("!!! replaying request with unkown method: " + request["method"]);
      }

      console.log(">>> replaying " + request["method"] + " request to " + request["url"]);

      xhr.open(request["method"], request["url"], async);

      const waitId = request_interceptor.requireWaitId();
      xhr.setRequestHeader("X-Mitch-WaitId", waitId);

      if (request["method"].toUpperCase() != "GET") {
         if (request["isJson"]) {
            xhr.setRequestHeader("Content-Type", "application/json");
         } else {
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
         }
         xhr.send(request["postBody"]);
      } else {
         const paramsString = [];
         for (let key in request["params"]) {
            paramsString.push(key + "=" + encodeURIComponent(request["params"][key]));
         }
         xhr.send(paramsString.join("&"));
      }

      await request_interceptor.waitRequest(waitId);
   }
}

async function start_Alice1() {
   active_collector = sensitive_requests;
   request_interceptor = interceptRequests(requestHandler);
   console.log("Intercepting requests...");
   phase = 0;
}

async function finished_Alice1() {
   await request_interceptor.stop();
   console.log("Alice run finished, preparing CSRF test forms...");
   console.log("Please logout from the current session and notify the extension");
   phase = 1;
}

async function logged_out_Alice1() {
   console.log("Alice logged out, please login as Bob and notify the extension");
   phase = 2;
}

async function logged_in_Bob() {
   console.log("Logged in as Bob, testing sensitive requests...");
   active_collector = bob_requests;
   request_interceptor = interceptRequests(requestHandler);
   await replayRequests(sensitive_requests);
   await request_interceptor.stop();
   console.log("Please logout from Bob's account and notify the extension");
   phase = 3;
}

async function logged_out_Bob() {
   console.log("Logged out as Bob, please login as Alice again and notify the extension");
   phase = 4;
}

async function logged_in_Alice2() {
   console.log("Logged in as Alice again, testing sensitive requests...");
   active_collector = alice1_requests;
   request_interceptor = interceptRequests(requestHandler);
   await replayRequests(sensitive_requests);
   await request_interceptor.stop();
   console.log("Please logout from Alice's account and notify the extension");
   phase = 5;
}

async function logged_out_Alice2() {
   console.log("Logged out as Alice, testing unauth sensitive requests...");
   active_collector = unauth_requests;
   request_interceptor = interceptRequests(requestHandler);
   await replayRequests(sensitive_requests);
   await request_interceptor.stop();
   console.log("All data has been collected");
   phase = 6;
}

async function make_conclusions() {
   console.log("Making conclusions");
   console.log(sensitive_requests, alice1_requests, bob_requests, unauth_requests);
   const candidates = guessCSRFs(sensitive_requests, alice1_requests, bob_requests, unauth_requests);
   console.log("search for possible CSRFs finished, please expand the array presented here to see candidates:");
   console.log(candidates);
   const results_url = chrome.extension.getURL("results.html");
   chrome.tabs.create({ url: results_url, active: true });
   phase = 7;
}

chrome.runtime.onMessage.addListener( async request => {
   if (request.type === "phase") {
      return phase;
   } else if (request.type === "start_Alice1" && phase === -1) {
      await start_Alice1();
      return true;
   } else if (request.type === "collected_sensitive_requests") {
      return collected_sensitive_requests;
   } else if (request.type === "collected_total_requests") {
      return collected_total_requests;
   } else if (request.type === "finished_Alice1" && phase === 0) {
      await finished_Alice1();
      return true;
   } else if (request.type === "logged_out_Alice1" && phase === 1) {
      await logged_out_Alice1();
      return true;
   } else if (request.type === "logged_in_Bob" && phase === 2) {
      await logged_in_Bob();
      return true;
   } else if (request.type === "logged_out_Bob" && phase === 3) {
      await logged_out_Bob();
      return true;
   } else if (request.type === "logged_in_Alice2" && phase === 4) {
      await logged_in_Alice2();
      return true;
   } else if (request.type === "logged_out_Alice2" && phase === 5) {
      await logged_out_Alice2();
      return true;
   } else if (request.type === "guessCSRFs" && phase >= 6) {
      return guessCSRFs(sensitive_requests, alice1_requests, bob_requests, unauth_requests);
   } else if (request.type === "tellCSRFs" && phase >= 6) {
      return tellCSRFs(sensitive_requests, alice1_requests, bob_requests, unauth_requests);
   } else if (request.type === "echo") { // Just for testing ...
      return request.data;
   }
   return false;
});