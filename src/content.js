import Anthropic from "@anthropic-ai/sdk";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import tailwindCSS from "./styles/tailwind-output.css";
import { JQCODE } from "./jquery.min.js";

// Function to get the API key from chrome.storage
function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["apiKey"], function (result) {
      if (result.apiKey) {
        resolve(result.apiKey);
      } else {
        reject("API key not set. Please set it in the extension options.");
      }
    });
  });
}

// PromptUI component
const PromptUI = ({
  onSubmit,
  isVisible,
  onClose,
  prompt,
  setPrompt,
  isLoading,
  historyDescriptions,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(prompt);
  };

  if (!isVisible) return null;

  const formRef = React.useRef(null);

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
            {historyDescriptions.slice().reverse().map((desc, index) => (
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

const App = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyDescriptions, setHistoryDescriptions] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      } else if (e.key === "Escape" && isVisible) {
        setIsVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  const handleSubmit = async (prompt) => {
    setIsLoading(true);
    try {
      const apiKey = await getApiKey();
      const anthropic = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      // Get a minified version of the current page HTML
      const minifiedHTML = await pageComm.eval(`(() => {
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

      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Given this minified HTML of a webpage: "${minifiedHTML}", generate jQuery code to perform this user request: "${prompt}". Wrap the code in \`\`\`javascript
  \`\`\`
  
  Coding rules:
  - Never use query selectors based on index, because we remove some elements that aren't informative.
  `,
          },
        ],
      });

      // Execute the generated jQuery code in the actual page
      const generatedCode = msg.content[0].text.match(
        /```javascript\n([\s\S]*?)\n```/
      )[1];
      console.log("Generated jQuery code:", generatedCode);
      const result = await pageComm.eval(generatedCode, false);
      console.log("Result of generated code:", result);
      console.log(msg);
      setHistoryDescriptions((prev) => [...prev, prompt]);
      setIsVisible(false);
      setPrompt(""); // Clear the input after submission completes
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    } finally {
      setIsLoading(false);
    }
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

    // Render the root component
    root.render(<App />);
  } catch (error) {
    console.error("Error in main function:", error);
  }
}
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
    eval: (code, capture = true) =>
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
