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

async function getMinifiedHTML(): Promise<string> {
  // @ts-ignore
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
      }).end().html().trim();
  })()`);
}


async function clearChromeStorage() {
  return new Promise<void>((resolve) => {
    // @ts-ignore
    chrome.storage.sync.get(['apiKey'], (result) => {
      const apiKey = result.apiKey;
      // @ts-ignore
      chrome.storage.sync.clear(() => {
        // @ts-ignore
        chrome.storage.sync.set({ apiKey }, () => {
          console.log("Chrome storage cleared, except for API key");
          resolve();
        });
      });
    });
  });
}
// @ts-ignore
window.clear = clearChromeStorage;


const App: React.FC<{ initialState: State }> = ({ initialState }) => {
  
  const [isVisible, setIsVisible] = useState(!initialState.done);
  const [prompt, setPrompt] = useState(initialState.userRequest);
  const [isLoading, setIsLoading] = useState(!initialState.done);
  const [historyDescriptions, setHistoryDescriptions] = useState([]);
  const [isDone, setIsDone] = useState(initialState.done);
  const doingAction = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!isDone && isLoading) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        // @ts-ignore
        chrome.storage.sync.get(['state'], async function(result) {
          const state = result.state || defaultState;
          if (state.done) {
            setIsDone(true);
            setPrompt('');
            setIsLoading(false);
            setIsVisible(false);
            doingAction.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
          } else {
            if (!doingAction.current) {
              doingAction.current = true;
              await doAction();
              doingAction.current = false;
            }
          }
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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

    // get state to init App
    let fetchedState = await getState();

    // Render the root component
    root.render(<App initialState={fetchedState} />);
  } catch (error) {
    console.error("Error in main function:", error);
  }
}


let anthropic: Anthropic | null = null;

async function getState(): Promise<State> {
  return new Promise<State>((resolve) => {
    // @ts-ignore
    chrome.storage.sync.get(['state'], function(result: { state?: State }) {
      resolve(result.state || { ...defaultState });
    });
  });
}

// Function to perform the main action
async function doAction() {
  try {
    // Get a minified version of the current page HTML
    const minifiedHTML = await getMinifiedHTML();
    // Truncate minifiedHTML to 10000 characters if it's longer
    const truncatedHTML = minifiedHTML.length > 10000 ? minifiedHTML.slice(0, 10000) : minifiedHTML;
    let state: State = await getState();
    // first message
    const msg = await anthropic!.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [
        { 
          role: "user", 
          content: `
          
          <page html>
          ${truncatedHTML}
          </page html>
          
          <user request>
          ${state.userRequest}
          </user request>

          <current url>
          ${document.URL}
          </current url>

          <history of previous descriptions>
          \`\`\`history
          ${state.descriptionHistory.join('\n')}
          \`\`\`
          </history of previous descriptions>

          Everything that is in the history **has already been completed**.
          
          To fulfil the user request, you can generate jQuery code. If you are done, you don't need to generate any code, just set done to true.
         
          Coding rules:
          - Never use query selectors based on index, because we remove some elements that aren't informative.
          - Don't define const, only define 'var' variables.
          - When using click, make sure to get the native click on the native element, not a simulated click.
          - Only write code that will be executed in the current page, not code that will be executed after navigation.
          - The user request does not have to be satisfied in one go, but try to do everything that can be done on the current page.
          - Only use jQuery to select the elements, actions should always use vanilla JS on the native element.

          Please provide your response in the following format:
          
          Description: [A single line describing what the code does]
          Code:
          \`\`\`javascript
          [Your generated jQuery code here]
          \`\`\`
          Done: [true/false]

          Set Done to true if the user request is satisfied.
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
    if(done){
      state.userRequest = '';
    }
    // @ts-ignore
    chrome.storage.sync.set({ state });
    
    // Execute the generated jQuery code in the actual page
    if (generatedCode) {
      await pageComm.eval(generatedCode, false);
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