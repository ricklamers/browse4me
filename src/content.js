import Anthropic from '@anthropic-ai/sdk';

// Function to communicate with the page
const pageComm = (() => {
  const listeners = new Map();
  let messageId = 0;
  let mainExecuted = false;

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data.sender !== 'page') return;
    
    if (event.data.type === 'response') {
      const listener = listeners.get(event.data.id);
      if (listener) {
        listeners.delete(event.data.id);
        listener(event.data.result);
      }
    } else if (event.data.type === 'jQueryLoaded' && !mainExecuted) {
      mainExecuted = true;
      main();
    }
  });

  return {
    eval: (code) => new Promise((resolve) => {
      const id = messageId++;
      listeners.set(id, resolve);
      window.postMessage({ sender: 'content', type: 'eval', id, code }, '*');
    })
  };
})();

// Inject script to set up message listener in the actual page
const pageScript = `
  (() => {
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.data.sender !== 'content') return;
      
      if (event.data.type === 'eval') {
        try {
          const result = eval(event.data.code);
          window.postMessage({ sender: 'page', type: 'response', id: event.data.id, result }, '*');
        } catch (error) {
          window.postMessage({ sender: 'page', type: 'response', id: event.data.id, result: { error: error.message } }, '*');
        }
      }
    });

    let jQueryLoadedMessageSent = false;
    function checkJQuery() {
      if (window.jQuery && !jQueryLoadedMessageSent) {
        jQueryLoadedMessageSent = true;
        window.postMessage({ sender: 'page', type: 'jQueryLoaded' }, '*');
      } else if (!window.jQuery) {
        setTimeout(checkJQuery, 100);
      }
    }
    checkJQuery();
  })();
`;

const script = document.createElement('script');
script.textContent = pageScript;
document.head.appendChild(script);

// Function to get the API key from chrome.storage
function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['apiKey'], function(result) {
      if (result.apiKey) {
        resolve(result.apiKey);
      } else {
        reject('API key not set. Please set it in the extension options.');
      }
    });
  });
}

// Main function to be executed after jQuery is loaded
async function main() {
  try {
    const apiKey = await getApiKey();
    const anthropic = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });
    
    // Get a minified version of the current page HTML
    const minifiedHTML = await pageComm.eval(`
      $('html').clone().find('script,link,style').remove().end().html().replace(/\\s+/g, ' ').trim();
    `);

    // Generate jQuery code to perform a page action
    const userRequest = prompt("Enter your request:");
    if (!userRequest) {
      console.log("User cancelled the request.");
      return;
    }

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        { 
          role: "user", 
          content: `Given this minified HTML of a webpage: "${minifiedHTML}", generate jQuery code to perform this user request: "${userRequest}". Wrap the code in \`\`\`javascript
<code>
\`\`\`` 
        }
      ],
    });

    // Execute the generated jQuery code in the actual page
    const generatedCode = msg.content[0].text.match(/```javascript\n([\s\S]*?)\n```/)[1];
    console.log("Generated jQuery code:", generatedCode);
    const result = await pageComm.eval(generatedCode);
    console.log("Result of generated code:", result);

    console.log(msg);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Load jQuery in the actual page
pageComm.eval(`
  if (!window.jQuery) {
    const script = document.createElement('script');
    script.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
    script.onload = () => window.postMessage({ sender: 'page', type: 'jQueryLoaded' }, '*');
    document.head.appendChild(script);
  } else {
    window.postMessage({ sender: 'page', type: 'jQueryLoaded' }, '*');
  }
`);