import Anthropic from "@anthropic-ai/sdk";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import tailwindCSS from "./styles/tailwind-output.css";
import { JQCODE } from "./jquery.min.js";

// Function to communicate with the page
const pageComm = (() => {
  const listeners = new Map();
  let messageId = 0;
  let mainExecuted = false;

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data.sender !== "page") return;

    if (event.data.type === "response") {
      const listener = listeners.get(event.data.id);
      if (listener) {
        listeners.delete(event.data.id);
        listener(event.data.result);
      }
    } else if (event.data.type === "jQueryLoaded" && !mainExecuted) {
      mainExecuted = true;
      main();
    }
  });

  return {
    eval: (code: string, capture = true) =>
      new Promise((resolve) => {
        const id = messageId++;
        listeners.set(id, resolve);
        const script = document.createElement("script");
        script.textContent = `
          try {
            ${capture ? 'const result = (() => {\n return ' : ''}${code}${capture ? '\n})();' : ''}
            window.postMessage({ sender: 'page', type: 'response', id: ${id}, result: ${capture ? 'result' : '{}'} }, '*');
          } catch (error) {
            window.postMessage({ sender: 'page', type: 'response', id: ${id}, result: { error: error.message } }, '*');
          }
          document.currentScript.remove();
        `;
        document.head.appendChild(script);
      }),
  };
})();

// Inject script to set up message listener in the actual page
const pageScript = `
  (() => {
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.data.sender !== 'content') return;
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

const script = document.createElement("script");
script.textContent = pageScript;
document.head.appendChild(script);

// Load jQuery in the actual page
const jQueryScript = document.createElement("script");
jQueryScript.textContent = atob(JQCODE);
document.head.appendChild(jQueryScript);

// Check if jQuery is loaded
const checkJQueryScript = document.createElement("script");
checkJQueryScript.textContent = `
  if (window.jQuery) {
    window.postMessage({ sender: 'page', type: 'jQueryLoaded' }, '*');
  }
`;
document.head.appendChild(checkJQueryScript);


// PromptUI component
const PromptUI = ({
  onSubmit,
  isVisible,
  onClose,
  prompt,
  setPrompt,
  isLoading,
  historyDescriptions,
}: {
  onSubmit: (prompt: string) => void;
  isVisible: boolean;
  onClose: () => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  historyDescriptions: string[];
}) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(prompt);
  };

  if (!isVisible) return null;

  const formRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (formRef.current) {
      const formHeight = formRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const padding = 20;
      const translateY = isLoading
        ? windowHeight / 2 - formHeight / 2 - padding
        : 0;
      formRef.current.style.transform = `translateY(${translateY}px)`;
    }
  }, [isLoading]);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-all duration-300 ease-in-out ${
        isLoading ? "bg-transparent" : "bg-black bg-opacity-30"
      }`}
      tabIndex={0}
    >
      <div ref={formRef} className="transition-all duration-300 ease-in-out">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow-lg z-50 w-full max-w-md"
        >
          {isLoading && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full animate-pulse"
                  style={{ width: "100%" }}
                ></div>
              </div>
            </div>
          )}
          <div className="mb-4 max-h-40 overflow-y-auto">
            {historyDescriptions.slice().reverse().map((desc: string, index: number) => (
              <div key={index} className="text-base text-gray-600 mb-1">
                {desc}
              </div>
            ))}
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to do"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`mt-4 w-full py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
};

async function getMinifiedHTML() {
  return await pageComm.eval(`(() => {
    const attributesToRemove = new Set(['lang', 'style', 'src', 'srcset']);
    return $('html').clone()
      .find('script,link,style').remove().end()
      .find('meta:not([name="description"])').remove().end()
      .find('*').each(function() {
        const $this = $(this);
        const attributesToRemoveForElement = [];
        $.each(this.attributes, function() {
          if (attributesToRemove.has(this.name) || this.name.startsWith('data-')) {
            attributesToRemoveForElement.push(this.name);
          }
        });
        attributesToRemoveForElement.forEach(attr => {
          $this.removeAttr(attr);
        });
      }).end().html().replace(/\s+/g, ' ').trim();
  })()`);
}

const App = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyDescriptions, setHistoryDescriptions] = useState([]);
  const [isDone, setIsDone] = useState(true);
  const doingAction = useRef(false);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setIsVisible((prev: boolean) => !prev);
      } else if (e.key === "Escape" && isVisible) {
        setIsVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (!isDone && isLoading) {
      intervalId = setInterval(() => {
        // @ts-ignore
        chrome.storage.sync.get(['state'], function(result) {
          const state = result.state || defaultState;
          if (state.done) {
            setIsDone(true);
            setIsLoading(false);
            doingAction.current = false;
            if (intervalId) clearInterval(intervalId);
          } else {
            if (!doingAction.current) {
              doingAction.current = true;
              do_action();
              let state = await getState();
              doingAction.current = false;
            }
          }
        });
      }, 4000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isDone, isLoading]);

  const handleSubmit = async (prompt: string) => {
    setIsLoading(true);
    setIsDone(false);
    // @ts-ignore
    chrome.storage.sync.set({ state: { ...defaultState, done: false, userRequest: prompt } });

  };

  return (
    <PromptUI
      isVisible={isVisible}
      onClose={() => setIsVisible(false)}
      onSubmit={handleSubmit}
      prompt={prompt}
      setPrompt={setPrompt}
      isLoading={isLoading}
      historyDescriptions={historyDescriptions}
    />
  );
};

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


// Main function to be executed after jQuery is loaded
async function main() {
  try {
    // Create a container for the React component
    const container = document.createElement("div");
    const shadowRoot = container.attachShadow({ mode: "closed" });

    // Create a style element and add Tailwind CSS
    const style = document.createElement("style");
    style.textContent = tailwindCSS;
    shadowRoot.appendChild(style);

    // Create a div to render the React component
    const reactContainer = document.createElement("div");
    shadowRoot.appendChild(reactContainer);

    document.body.appendChild(container);

    // Create a root using createRoot
    const root = createRoot(reactContainer);

    const apiKey = await getApiKey();
    anthropic = new Anthropic({
      apiKey: apiKey as string,
      dangerouslyAllowBrowser: true,
    });

    // Render the root component
    root.render(<App />);
  } catch (error) {
    console.error("Error in main function:", error);
  }
}


let anthropic: Anthropic | null = null;

// // Main function to be executed after jQuery is loaded
// async function setup_() {
//   console.log("Setup");
//   try {
//     const apiKey = await getApiKey();
//     anthropic = new Anthropic({
//       apiKey: apiKey as string,
//       dangerouslyAllowBrowser: true,
//     });

//     let state: State = await new Promise((resolve) => {
//       // @ts-ignore
//       chrome.storage.sync.get(['state'], function(result: { state?: State }) {
//         resolve(result.state || { ...defaultState });
//       });
//     });

//     if (!state.done) {
//       loop()
//     }
//   } catch (error) {
//     console.error("Error:", error);
//   }
// }


async function getState(): Promise<State> {
  return new Promise<State>((resolve) => {
    // @ts-ignore
    chrome.storage.sync.get(['state'], function(result: { state?: State }) {
      resolve(result.state || { ...defaultState });
    });
  });
}

// async function loop() {

//   while (!state.done) {
//     console.log("State:", state);
//     console.log("Doing action");
//     await do_action(state)
//     // Sleep for a short duration to avoid overwhelming the system
//     await new Promise(resolve => setTimeout(resolve, 2000));
//     state = await getState();
//   }
// }



// Function to perform the main action
async function do_action() {
  try {
    // Get a minified version of the current page HTML
    const minifiedHTML = await getMinifiedHTML();
    let state: State = await getState();
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
         
          Coding rules:
          - Never use query selectors based on index, because we remove some elements that aren't informative.

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