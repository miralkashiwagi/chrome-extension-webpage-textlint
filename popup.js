var worker = new Worker("dist/textlint-worker.js");

document.getElementById("btn").addEventListener("click", function () {
  btn.disabled = true; // Disable the button immediately after clicked
  btn.innerText = "再実行するにはページをリロード";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        function: getBodyText,
      },
      handleResult
    );
  });

  function getBodyText() {
    return document.body.innerText;
  }

  function handleResult(result) {
    worker.postMessage({
      command: "lint",
      text: result[0].result,
      ext: ".html",
    });
  }
});
worker.onmessage = async function (event) {
  if (event.data.command === "lint:result") {
    // receive lint result
    console.dir(event.data.result.messages);
    highlightErrors(event.data.result.messages);
    if (event.data.result.messages.length === 0) {
      showMessageNoErrors();
    } else {
      highlightErrors(event.data.result.messages);
    }
  }
};

function highlightErrors(errors) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: applyErrorHighlights,
      args: [errors],
    });
  });

  function applyErrorHighlights(errors) {
    let style = document.createElement("style");
    style.innerHTML = `
            .tl-e {
            text-decoration:underline;/*下線を引く*/
            text-decoration-style:wavy;/*下線を波線で表示*/
            text-decoration-color:red;
            text-decoration-skip-ink: none;
            scroll-margin-top:200px;
            background:yellow;
            }`;

    document.head.appendChild(style);

    // Split the innerHTML into lines
    const lines = document.body.innerText.split("\n");

    // Apply each error in reverse order
    errors.reverse().forEach((error) => {
      const lineNumber = error.loc.start.line - 1; // 1-based to 0-based
      const columnStart = error.loc.start.column - 1; // 1-based to 0-based
      const columnEnd = error.loc.end.column - 1; // include the character at end column

      const line = lines[lineNumber];
      const before = line.slice(0, columnStart);
      const targetText = line.slice(columnStart, columnEnd);
      const after = line.slice(columnEnd);

      lines[
        lineNumber
      ] = `${before}<span class='tl-e' title='${error.message}'>${targetText}</span>${after}`;
    });

    // Join the lines back and set as new inner HTML
    document.body.innerHTML = lines.join("\n");

    // Get the first error highlight
    const firstErrorHighlight = document.querySelector(".tl-e");
    console.log("scroll");
    console.log(firstErrorHighlight);

    // If there is an error highlight, scroll into view
    if (firstErrorHighlight) {
      firstErrorHighlight.scrollIntoView({ behavior: "smooth" });
    }
  }
}

function showMessageNoErrors() {
  // Get the button element
  var buttonElement = document.getElementById("btn");

  // Create new paragraph element
  var pElement = document.createElement("p");
  pElement.textContent = "エラーはありませんでした";

  // Append new paragraph element after button
  buttonElement.parentNode.insertBefore(pElement, buttonElement.nextSibling);
}
