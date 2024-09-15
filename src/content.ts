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
      setup();
    }
  });

  return {
    eval: (code: string) => new Promise((resolve) => {
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
    // @ts-ignore
    chrome.storage.sync.get(['apiKey'], function(result: { apiKey?: string }) {
      if (result.apiKey) {
        resolve(result.apiKey);
      } else {
        reject('API key not set. Please set it in the extension options.');
      }
    });
  });
}


// Define state type and initialize state object
interface State {
  descriptionHistory: string[];
  messages: Anthropic.Messages.MessageParam[];
  previousCode: string[];
  userRequest: string;
  done: boolean;
}

const defaultState: State = {
  descriptionHistory: [],
  messages: [],
  previousCode: [],
  userRequest: '',
  done: true
};



let anthropic: Anthropic | null = null;

// Main function to be executed after jQuery is loaded
async function setup() {
  console.log("Setup");
  try {
    const apiKey = await getApiKey();
    anthropic = new Anthropic({
      apiKey: apiKey as string,
      dangerouslyAllowBrowser: true,
    });

    let state: State = await new Promise((resolve) => {
      // @ts-ignore
      chrome.storage.sync.get(['state'], function(result: { state?: State }) {
        resolve(result.state || { ...defaultState });
      });
    });

    // Add event listener for cmd+k (or ctrl+k for non-Mac)
    document.addEventListener('keydown', function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        
        // Prompt the user for input
        const userInput = prompt("Enter your request:");
        
        if (userInput) {
          // If user provided input, update the userRequest variable
          const done = userInput.toLowerCase() === "done";
          state = { ...defaultState, done: done, userRequest: userInput };
          console.log("User request:", userInput);
          // @ts-ignore
          chrome.storage.sync.set({ state });
          loop()
          // You might want to trigger the main logic here or set a flag to process the request
        } else {
          console.log("User cancelled the request.");
        }
      }
    });

    if (!state.done) {
      loop()
    }
  } catch (error) {
    console.error("Error:", error);
  }
}


async function getState(): Promise<State> {
  return new Promise<State>((resolve) => {
    // @ts-ignore
    chrome.storage.sync.get(['state'], function(result: { state?: State }) {
      resolve(result.state || { ...defaultState });
    });
  });
}

async function loop() {
  let state: State = await getState();
  while (!state.done) {
    console.log("State:", state);
    console.log("Doing action");
    await do_action(state)
    // Sleep for a short duration to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000));
    state = await getState();
  }
}



// Function to perform the main action
async function do_action(state: State) {
  try {
    // Get a minified version of the current page HTML
    const minifiedHTML = await pageComm.eval(`
      $('html').clone().find('script,link,style').remove().end().html().replace(/\\s+/g, ' ').trim();
    `);

    // first message
    const msg = await anthropic!.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [
        { 
          role: "user", 
          content: `Given this minified HTML of a webpage: "${minifiedHTML}", generate jQuery code to perform this user request: "${state.userRequest}". 
          
          Analyze the HTML of the page carefully, only write code that targets elements on the current page (using the HTML given).
          When using click, make sure to get the native click on the native element, not a simulated click.
          This action is part of a loop that continues until the user request is satisfied. You can navigate to different pages, and the loop will continue.
          The action does not have to be satisfied in one step, but the fewer steps the better.
          Only write code that will be executed in the current page, not code that will be executed after navigation.
         
          History of previous descriptions:
          
          \`\`\`history
          ${state.descriptionHistory.join('\n')}
          \`\`\`

          If this is the first request, the previous history will be empty.

          If according the history and the html, the user request is satisfied, you can set done to true.
          
          Please provide your response in the following format:
          
          Description: [A single line describing what the code does]
          Code:
          \`\`\`javascript
          [Your generated jQuery code here]
          \`\`\`
          Done: [true/false]
          `
        }
      ],
    });

    const textblock = msg.content[0] as Anthropic.Messages.TextBlock;
    const content = textblock.text;
    const description = content.match(/Description:\s*(.*)/)?.[1] || '';
    const generatedCode = content.match(/```javascript\n([\s\S]*?)\n```/)?.[1] || '';
    const done = /Done:\s*true/i.test(content);

    console.log("Description:", description);
    console.log("Generated jQuery code:", generatedCode);
    console.log("Done:", done);
    console.log("Previous history:", state.descriptionHistory);

    
    // Update the previous history
    state.descriptionHistory.push(description);
    state.previousCode.push(generatedCode);
    state.messages.push(msg);
    // Update state
    state.done = done;
    // @ts-ignore
    chrome.storage.sync.set({ state });
    
    // Execute the generated jQuery code in the actual page
    if (!done && generatedCode) {
      const result = await pageComm.eval(generatedCode);
      console.log("Result of generated code:", result);
    } else {
      console.log("No code was generated.");
    }
  } catch (error) {
    console.error("Error:", error);
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