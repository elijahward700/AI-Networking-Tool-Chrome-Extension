document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup script loaded");
    
    // Add global error handler to prevent UI getting stuck
    window.addEventListener('error', function(event) {
        console.error("Global error caught:", event.error);
        
        // Try to recover UI if it appears to be in loading state
        if (document.getElementById('loading') && document.getElementById('loading').style.display !== 'none') {
            console.log("Recovering UI from error during loading state");
            document.getElementById('loading').style.display = 'none';
            document.getElementById('capture-button').disabled = false;
            if (document.getElementById('cancel-container')) {
                document.getElementById('cancel-container').classList.add('hidden');
            }
            
            // Keep contacts upload container hidden
            document.getElementById('contacts-upload-container').classList.add('hidden');
            
            // Try to show an error message
            try {
                const statusElem = document.createElement('div');
                statusElem.textContent = "An unexpected error occurred. Please try again.";
                statusElem.style.padding = '5px';
                statusElem.style.marginTop = '5px';
                statusElem.style.borderRadius = '3px';
                statusElem.style.backgroundColor = '#ffebee';
                statusElem.style.color = '#c62828';
                statusElem.className = 'status-message';
                document.body.appendChild(statusElem);
            } catch (e) {
                console.error("Failed to show error status:", e);
            }
        }
    });
    
    // Initialize state variables
    let capturedContentData = '';
    let classificationInProgress = false;
    
    // Show version information for debugging
    const manifest = chrome.runtime.getManifest();
    console.log(`Extension version: ${manifest.version}`);
    
    // Initialize debug log
    addDebugLog(`Extension popup initialized (v${manifest.version})`);
    
    // Initialize tag input placeholder
    document.getElementById('tag-input').placeholder = 'Type a tag and press Enter';
    
    // Initialize tags list
    document.getElementById('tags-list').innerHTML = '';
    
    // Set up event listeners for buttons
    document.getElementById('capture-button').addEventListener('click', function() {
      captureTextContent(); // Standard capture
    });
    
    document.getElementById('copy-button').addEventListener('click', function() {
      copyContent();
    });
    
    document.getElementById('download-button').addEventListener('click', function() {
      downloadContent();
    });
    
    document.getElementById('summarize-button').addEventListener('click', function() {
      showSummaryUI();
    });
    
    // Set up API key handling
    document.getElementById('save-api-key').addEventListener('click', function() {
      const apiKey = document.getElementById('api-key').value.trim();
      if (apiKey) {
        // Show loading indicator for API key saving
        const saveButton = document.getElementById('save-api-key');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saving...';
        saveButton.disabled = true;
        
        chrome.storage.local.set({ 'openai_api_key': apiKey }, function() {
          // Hide the API key container
          document.getElementById('api-key-container').classList.add('hidden');
          
          // Log the event
          addDebugLog("API key saved successfully");
          
          // Show a success banner for the API key save
          addStatusBanner("API key saved! Content will be automatically analyzed.", 'success');
          
          // Reset button state
          saveButton.textContent = originalText;
          saveButton.disabled = false;
          
          // Try to classify current content with new key
          if (capturedContentData && capturedContentData.length > 0) {
            // Add a small delay to ensure UI has updated
            setTimeout(() => {
              addDebugLog("Starting classification with newly saved API key");
              classifyContent({
                text: capturedContentData,
                type: 'text'
              }, apiKey);
            }, 300);
          }
        });
      } else {
        // Show error if API key is empty
        addStatusBanner("Please enter a valid API key", 'error');
      }
    });
    
    // Set up contacts file upload handling
    document.getElementById('upload-contacts-button').addEventListener('click', function() {
      const fileInput = document.getElementById('contacts-file');
      if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      reader.onload = function(e) {
          const csvContent = e.target.result;
          try {
            const contacts = parseCSV(csvContent);
            if (contacts && contacts.length > 0) {
              chrome.storage.local.set({ 'contacts': contacts }, function() {
                document.getElementById('contacts-status').textContent = `${contacts.length} contacts loaded successfully`;
                document.getElementById('contacts-status').style.color = 'green';
              });
            } else {
              document.getElementById('contacts-status').textContent = 'No valid contacts found in file';
              document.getElementById('contacts-status').style.color = 'red';
            }
          } catch (error) {
            document.getElementById('contacts-status').textContent = 'Error parsing CSV: ' + error.message;
            document.getElementById('contacts-status').style.color = 'red';
          }
      };
      
      reader.onerror = function() {
          document.getElementById('contacts-status').textContent = 'Error reading file';
          document.getElementById('contacts-status').style.color = 'red';
      };
      
      reader.readAsText(file);
      } else {
        document.getElementById('contacts-status').textContent = 'Please select a CSV file';
        document.getElementById('contacts-status').style.color = 'red';
      }
    });
    
    // Match contacts button
    document.getElementById('match-contacts-button').addEventListener('click', function() {
      const tags = getTagsFromList();
      
      if (tags.length === 0) {
        document.getElementById('matched-contacts').style.display = 'block';
        document.getElementById('matched-contacts-list').innerHTML = '<div class="contact-item">Please enter at least one tag</div>';
        return;
      }
      
      chrome.storage.local.get(['contacts'], function(result) {
        if (result.contacts && result.contacts.length > 0) {
          const matchedContacts = findMatchingContacts(tags, result.contacts);
          displayMatchedContacts(matchedContacts);
        } else {
          document.getElementById('matched-contacts').style.display = 'block';
          document.getElementById('matched-contacts-list').innerHTML = '<div class="contact-item">No contacts loaded. Please upload a CSV file.</div>';
        }
      });
    });
    
    // Set up tag input handling
    document.getElementById('tag-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tagText = this.value.trim();
        if (tagText) {
          addTagToList(tagText);
          this.value = '';
        }
      }
    });
    
    // Function to add a tag to the list
    function addTagToList(tagText) {
      const tagsList = document.getElementById('tags-list');
      const tagItem = document.createElement('div');
      tagItem.className = 'tag-item';
      tagItem.title = 'Click to remove tag';
      tagItem.innerHTML = `<span class="tag-text">${tagText}</span>`;
      
      // Add event listener to remove tag on click
      tagItem.addEventListener('click', function() {
        tagItem.remove();
      });
      
      tagsList.appendChild(tagItem);
    }
    
    // Function to get all tags from the list
    function getTagsFromList() {
      const tagElements = document.querySelectorAll('.tag-item .tag-text');
      return Array.from(tagElements).map(el => el.textContent.trim());
    }
    
    // Function to populate the tags list from a comma-separated string
    function populateTagsList(tagsString) {
      const tagsList = document.getElementById('tags-list');
      tagsList.innerHTML = ''; // Clear existing tags
      
      if (!tagsString) return;
      
      const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      tags.forEach(tag => addTagToList(tag));
    }
    
    /* Helper functions */
    
    // Parse CSV file
    function parseCSV(csvContent) {
      const rows = csvContent.split('\n');
      const contacts = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;
        
        // Simple CSV parsing - split on comma
        const fields = row.split(',');
        if (fields.length >= 2) {
          const name = fields[0].trim();
          // Rest of fields are tags
          const tags = fields.slice(1).map(tag => tag.trim()).filter(tag => tag.length > 0);
          
          contacts.push({ name, tags });
        }
      }
      
      return contacts;
    }
    
    // Find contacts that match the article tags
    function findMatchingContacts(articleTags, contactsList) {
      const matchedContacts = [];
      
      // Convert article tags to lowercase for case-insensitive matching
      const lowerArticleTags = articleTags.map(tag => tag.toLowerCase());
      
      contactsList.forEach(contact => {
        // Convert contact tags to lowercase
        const lowerContactTags = contact.tags.map(tag => tag.toLowerCase());
        
        // Find matching tags
        const matches = lowerArticleTags.filter(tag => lowerContactTags.includes(tag));
        
        if (matches.length > 0) {
          matchedContacts.push({
            name: contact.name,
            matches: matches,
            matchCount: matches.length
          });
        }
      });
      
      // Sort by number of matching tags (descending)
      return matchedContacts.sort((a, b) => b.matchCount - a.matchCount);
    }
    
    // Helper function to extract first name from full name
    function getFirstName(fullName) {
      return fullName.split(' ')[0];
    }

    function displayMatchedContacts(matchedContacts) {
      const container = document.getElementById('matched-contacts');
      const list = document.getElementById('matched-contacts-list');
      
      if (matchedContacts.length === 0) {
        list.innerHTML = '<div class="contact-item">No matching contacts found</div>';
      } else {
        list.innerHTML = '';
        matchedContacts.forEach(contact => {
          const item = document.createElement('div');
          item.className = 'contact-item';
          
          // Create name container that's clickable
          const nameContainer = document.createElement('div');
          nameContainer.className = 'name-container clickable';
          const originalText = `${contact.name} (${contact.matches.join(', ')})`;
          nameContainer.textContent = originalText;
          
          // Add click handler for copying
          nameContainer.onclick = async () => {
            // Get current tab URL
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            const currentUrl = tabs[0].url;
            
            // Get first name
            const firstName = getFirstName(contact.name);
            
            // Format message
            const message = `Hey ${firstName}, this article reminded me of you and I thought you would find it interesting: ${currentUrl}`;
            
            // Copy to clipboard
            await navigator.clipboard.writeText(message);
            
            // Show feedback by temporarily changing the text and color
            const originalColor = nameContainer.style.color;
            nameContainer.style.color = '#4285f4';
            nameContainer.textContent = `Copied message for ${firstName} to clipboard`;
            
            setTimeout(() => {
              nameContainer.style.color = originalColor;
              nameContainer.textContent = originalText;
            }, 1500);
          };
          
          item.appendChild(nameContainer);
          list.appendChild(item);
        });
      }
      
      container.style.display = 'block';
    }
    
    // Generate a filename for downloading content
    function generateFileName(fileType) {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      let title = 'article';
      
      // Try to extract title from content
      if (capturedContentData) {
        const lines = capturedContentData.split('\n');
        for (const line of lines) {
          if (line.startsWith('Title:')) {
            title = line.substring(6).trim().toLowerCase();
            // Limit length and replace spaces with underscores
            title = title.substring(0, 30).replace(/\s+/g, '_');
            break;
          }
        }
      }
      
      return `${title}_${dateStr}.${fileType}`;
    }
    
    // Set status message
    function setStatus(message, style = 'default', persist = true) {
      const statusElem = document.createElement('div');
      statusElem.textContent = message;
      statusElem.style.padding = '5px';
      statusElem.style.marginTop = '5px';
      statusElem.style.borderRadius = '3px';
      
      if (style === 'error') {
        statusElem.style.backgroundColor = '#ffebee';
        statusElem.style.color = '#c62828';
      } else if (style === 'success') {
        statusElem.style.backgroundColor = '#e8f5e9';
        statusElem.style.color = '#2e7d32';
      } else {
        statusElem.style.backgroundColor = '#f5f5f5';
        statusElem.style.color = '#424242';
      }
      
      // Remove previous status messages if not persisting
      if (!persist) {
        Array.from(document.querySelectorAll('.status-message')).forEach(elem => {
          elem.remove();
        });
      }
      
      statusElem.className = 'status-message';
      document.body.appendChild(statusElem);
      
      // Auto-remove after delay unless it's an error
      if (style !== 'error' && !persist) {
        setTimeout(() => {
          statusElem.remove();
        }, 3000);
      }
    }
    
    // Add a status banner that animates in
    function addStatusBanner(message, type = 'success', animate = true) {
        const banner = document.createElement('div');
      banner.textContent = message;
      banner.style.padding = '10px';
      banner.style.margin = '10px 0';
      banner.style.borderRadius = '4px';
        banner.style.fontWeight = 'bold';
      banner.style.position = 'relative';
      
        if (type === 'success') {
          banner.style.backgroundColor = '#e8f5e9';
          banner.style.color = '#2e7d32';
        banner.style.border = '1px solid #a5d6a7';
        } else if (type === 'warning') {
        banner.style.backgroundColor = '#fff8e1';
        banner.style.color = '#f57f17';
        banner.style.border = '1px solid #ffe082';
        } else if (type === 'error') {
          banner.style.backgroundColor = '#ffebee';
          banner.style.color = '#c62828';
        banner.style.border = '1px solid #ef9a9a';
      } else {
        banner.style.backgroundColor = '#e3f2fd';
        banner.style.color = '#1565c0';
        banner.style.border = '1px solid #90caf9';
      }
      
      if (animate) {
          banner.style.opacity = '0';
        banner.style.transform = 'translateY(-20px)';
        banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      }
      
      // Insert at the top
      const firstChild = document.body.firstChild;
      document.body.insertBefore(banner, firstChild);
      
      // Trigger animation
      if (animate) {
          setTimeout(() => {
            banner.style.opacity = '1';
          banner.style.transform = 'translateY(0)';
          }, 10);
        }
        
        return banner;
    }
    
    // Add a log message to debug console (if exists)
    function addDebugLog(message, isError = false, isWarning = false) {
      try {
        // Create a debug console if it doesn't exist
        let debugConsole = document.getElementById('debug-console');
        if (!debugConsole) {
          debugConsole = document.createElement('div');
          debugConsole.id = 'debug-console';
          debugConsole.style.margin = '20px 0 0 0';
          debugConsole.style.padding = '10px';
          debugConsole.style.border = '1px solid #ddd';
          debugConsole.style.borderRadius = '4px';
          debugConsole.style.backgroundColor = '#f5f5f5';
          debugConsole.style.maxHeight = '200px';
          debugConsole.style.overflowY = 'auto';
          debugConsole.style.display = 'none';
          
          // Add a header with toggle button
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';
          header.style.padding = '5px 0';
          header.style.borderBottom = '1px solid #ddd';
          header.style.marginBottom = '10px';
          
          const title = document.createElement('h4');
          title.textContent = 'Debug Console';
          title.style.margin = '0';
          
          const toggleButton = document.createElement('button');
          toggleButton.textContent = 'Show Debug';
          toggleButton.style.fontSize = '12px';
          toggleButton.style.padding = '4px 8px';
          toggleButton.style.cursor = 'pointer';
          
          toggleButton.addEventListener('click', function() {
            const isHidden = debugConsole.style.display === 'none';
            debugConsole.style.display = isHidden ? 'block' : 'none';
            toggleButton.textContent = isHidden ? 'Hide Debug' : 'Show Debug';
          });
          
          header.appendChild(title);
          header.appendChild(toggleButton);
          
          // Add the debug console to the page at the end
          document.body.appendChild(debugConsole);
          
          // Create a container for the logs
          const logsContainer = document.createElement('div');
          logsContainer.id = 'debug-logs';
          debugConsole.appendChild(logsContainer);
        }
        
        const logDiv = document.createElement('div');
        logDiv.textContent = message;
        logDiv.style.padding = '2px 5px';
        logDiv.style.fontFamily = 'monospace';
        logDiv.style.fontSize = '12px';
        logDiv.style.whiteSpace = 'pre-wrap';
        logDiv.style.wordBreak = 'break-all';
        logDiv.style.borderBottom = '1px solid #eee';
        
          if (isError) {
          logDiv.style.color = '#e53935';
          } else if (isWarning) {
          logDiv.style.color = '#ff8f00';
          } else {
          logDiv.style.color = '#424242';
        }
        
        // Prepend log to keep newest at top
        const logsContainer = document.getElementById('debug-logs');
        logsContainer.insertBefore(logDiv, logsContainer.firstChild);
        
        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        logDiv.textContent = `[${timestamp}] ${message}`;
        
        // Log to background console (useful for debugging)
        chrome.runtime.sendMessage({
          action: "debug",
          data: message
        });
        
        console.log(`[DEBUG] ${message}`);
      } catch (e) {
        console.error("Error adding debug log:", e);
      }
    }
    
    // Function for capturing text content of an article
    function captureTextContent() {
      // Clear previous content
      capturedContentData = '';
      
      // Hide the contacts upload container
      document.getElementById('contacts-upload-container').classList.add('hidden');
      
      // Show loading indicator and update progress
      document.getElementById('loading').style.display = 'block';
      document.getElementById('options').style.display = 'none';
      document.getElementById('progress-bar').style.width = '5%';
      document.getElementById('loading-text').classList.add('loading-text');
      
      // Enable cancel button during capture
      document.getElementById('cancel-container').classList.remove('hidden');
      document.getElementById('cancel-button').disabled = false;
      
      // Disable action buttons during capture
      document.getElementById('capture-button').disabled = true;
      
      // Add debug log
      addDebugLog('Starting content capture');
      
      // Track if the capture has been cancelled
      let isCancelled = false;
      
      // Get current tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) {
          setStatus('Error: No active tab found', 'error');
          document.getElementById('loading').style.display = 'none';
          document.getElementById('capture-button').disabled = false;
          // Keep contacts upload container hidden
          document.getElementById('contacts-upload-container').classList.add('hidden');
          addDebugLog("Error: No active tab found", true);
          return;
        }
        
        const tab = tabs[0];
        addDebugLog(`Attempting to connect to tab ID: ${tab.id} at URL: ${tab.url}`);
        
        try {
          // Connect to content script
          addDebugLog("Establishing connection port...");
          const port = chrome.tabs.connect(tab.id, {name: "pdf-capture"});
          addDebugLog("Port connection established successfully.");
          
          // Add listener first, before sending message
          port.onMessage.addListener(function(response) {
            console.log("Received message from content script:", response);
            addDebugLog(`Received response: ${JSON.stringify(response).substring(0, 100)}...`);
            
            if (isCancelled) {
              addDebugLog("Ignoring message as capture was cancelled");
              return;
            }
            
            // Handle progress updates
            if (response.status === "progress") {
              document.getElementById('progress-bar').style.width = response.progress + '%';
              return;
            }
            
            // Handle cancelled response
            if (response.status === "cancelled") {
              setStatus('Capture cancelled', 'default');
              document.getElementById('loading').style.display = 'none';
              document.getElementById('capture-button').disabled = false;
              document.getElementById('cancel-container').classList.add('hidden');
              // Keep contacts upload container hidden
              document.getElementById('contacts-upload-container').classList.add('hidden');
              return;
            }
            
            // Handle error response
            if (response.status === "error") {
              addStatusBanner('Error: ' + (response.error || 'Unknown error'), 'error');
              document.getElementById('loading').style.display = 'none';
              document.getElementById('capture-button').disabled = false;
              document.getElementById('cancel-container').classList.add('hidden');
              // Keep contacts upload container hidden
              document.getElementById('contacts-upload-container').classList.add('hidden');
              addDebugLog("Error during capture: " + (response.error || 'Unknown error'), true);
              return;
            }
            
            // Handle success response
            if (response.status === "success") {
              // Store the captured content
              capturedContentData = response.data;
              
              // Set UI based on content type
              const isTrackingPixel = response.isTrackingPixel || response.stats?.isTrackingPixel;
              const isCrossOrigin = response.stats?.isCrossOrigin;
              
              // Hide loading
              document.getElementById('loading').style.display = 'none';
              
              // Hide cancel button
              document.getElementById('cancel-container').classList.add('hidden');
              
              // Update button text
              if (!isTrackingPixel) {
                document.getElementById('copy-button').textContent = 'Copy Text';
                document.getElementById('download-button').textContent = 'Download Text';
              }
              
              // Show options and enable buttons
              document.getElementById('options').style.display = 'block';
              document.getElementById('copy-button').disabled = false;
              document.getElementById('download-button').disabled = false;
              if (!isTrackingPixel) {
                document.getElementById('summarize-button').disabled = false;
              }
              
              // Re-enable capture buttons
              document.getElementById('capture-button').disabled = false;
              
              // Add a success banner that will persist
              if (!isTrackingPixel && !isCrossOrigin) {
                addStatusBanner('Content successfully captured!', 'success');
              }
              
              // If we have an API key, automatically start classification if not a tracking pixel or cross-origin
              if (!isTrackingPixel && !isCrossOrigin) {
                chrome.storage.local.get(['openai_api_key'], function(result) {
                  if (result.openai_api_key) {
                    // Get the API key
                    const apiKey = result.openai_api_key;
                    
                    // Only attempt classification if we have text content
                    if (capturedContentData && capturedContentData.length > 0) {
                      // Wait a moment before starting classification to let the UI update
                      setTimeout(() => {
                        addDebugLog("Starting automatic content classification");
                        // Call the classification function if it exists
                        classifyContent({
                          text: capturedContentData,
                          type: 'text'
                        }, apiKey);
                      }, 500);
                    }
                  } else {
                    // Show the API key container
                    document.getElementById('api-key-container').classList.remove('hidden');
                    addDebugLog("No API key found for classification. API key input shown.");
                  }
                });
              }
            }
          });
          
          // Separate function for cancellation, defined outside for clarity
          const cancelCapture = function() {
            if (isCancelled) return; // Prevent multiple cancellations
            
            isCancelled = true;
            addDebugLog("User initiated cancel request");
            
            try {
              port.postMessage({action: 'cancelCapture'});
              addDebugLog("Cancel message sent to content script");
            } catch (e) {
              addDebugLog(`Error sending cancel message: ${e.message}`, true);
            }
            
            // Update UI immediately to provide feedback
            setStatus('Cancelling capture...', 'default');
            document.getElementById('progress-bar').style.backgroundColor = '#FF9800';
            
            // Set a timeout to force reset if content script doesn't respond
            setTimeout(() => {
              if (document.getElementById('loading').style.display !== 'none') {
                addDebugLog("Forcing capture cancellation after timeout", true);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('capture-button').disabled = false;
                document.getElementById('cancel-container').classList.add('hidden');
                setStatus('Capture cancelled', 'default');
              }
            }, 2000);
          };
          
          // Add cancel handler and ensure we remove it after use to prevent duplicates
          const cancelButton = document.getElementById('cancel-button');
          cancelButton.removeEventListener('click', cancelCapture); // Remove any existing handlers
          cancelButton.addEventListener('click', cancelCapture);
          
          // Send message to content script to start capture
          const formatType = "plaintext"; // We always want plaintext for classification
          const message = {
            action: "fullCapture", 
            formatType: formatType,
            options: {
              timeoutMs: 30000 // 30 second timeout
            }
          };
          
          console.log("Sending message to content script:", message);
          addDebugLog('Sending capture request to content script...');
          
          port.postMessage(message);
          addDebugLog("Message sent to content script.");
          
          // Set the status AFTER successfully sending the message
          setStatus('Capture in progress...', 'default');
          
          // Also add a failsafe timeout in case the content script doesn't respond at all
          setTimeout(() => {
            if (!isCancelled && document.getElementById('loading').style.display !== 'none') {
              addDebugLog("No response from content script after timeout, resetting UI", true);
              document.getElementById('loading').style.display = 'none';
              document.getElementById('capture-button').disabled = false;
              document.getElementById('cancel-container').classList.add('hidden');
              setStatus('Capture failed - no response from page', 'error');
            }
          }, 45000); // 45 seconds, slightly longer than the content script timeout
          
        } catch (err) {
          // Handle connection error
          // Provide a more specific error if connection fails
          const errorDetail = err.message.includes('Could not establish connection') 
            ? 'Could not connect to the page. Try reloading the page or the extension.' 
            : err.message;
          setStatus(`Error starting capture: ${errorDetail}`, 'error');
          
          document.getElementById('loading').style.display = 'none';
          document.getElementById('capture-button').disabled = false;
          addDebugLog("Error establishing connection or sending message: " + err.message, true);
        }
      });
    }
    
    // Copy the captured content to clipboard
    function copyContent() {
      if (!capturedContentData) {
        setStatus('No content to copy', 'error');
        return;
      }
      
      try {
        navigator.clipboard.writeText(capturedContentData).then(() => {
          setStatus('Content copied to clipboard', 'success', false);
        }).catch(err => {
          setStatus('Failed to copy: ' + err, 'error');
        });
      } catch (e) {
        setStatus('Clipboard access denied: ' + e, 'error');
      }
    }
    
    // Download the captured content as a file
    function downloadContent() {
      if (!capturedContentData) {
        setStatus('No content to download', 'error');
        return;
      }
      
      const filename = generateFileName('txt');
      const blob = new Blob([capturedContentData], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
      
        const a = document.createElement('a');
      a.style.display = 'none';
        a.href = url;
      a.download = filename;
      
        document.body.appendChild(a);
        a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      setStatus('Content downloaded as ' + filename, 'success', false);
    }
    
    // Show the summary UI
    function showSummaryUI() {
      if (!capturedContentData) {
        setStatus('No content to summarize', 'error');
        return;
      }
      
      // For now just show a simple placeholder message
          document.getElementById('summary-container').style.display = 'block';
      document.getElementById('summary-content').textContent = 'Summarization feature is not implemented in this version.';
      setStatus('Summarization not fully implemented', 'default');
    }
    
    // Classify content using the OpenAI API
    function classifyContent(contentData, apiKey) {
      if (classificationInProgress) {
        addDebugLog("Classification already in progress, skipping duplicate request");
        return;
      }
      
      classificationInProgress = true;
      addDebugLog("Starting content classification with OpenAI");
      
      // Create a status banner to show processing
      const classificationBanner = addStatusBanner("Analyzing with AI...", "default");
      
      // Update tag input placeholder
      document.getElementById('tag-input').placeholder = 'AI is analyzing content...';
      
      // Extract text content
      let textToAnalyze = contentData.text || "";
      
      // Limit text to reduce token usage (OpenAI has token limits)
      // We'll take the beginning and end of the article if it's very long
      if (textToAnalyze.length > 4000) {
        const firstPart = textToAnalyze.substring(0, 2000);
        const lastPart = textToAnalyze.substring(textToAnalyze.length - 2000);
        textToAnalyze = firstPart + "\n[...content truncated...]\n" + lastPart;
        addDebugLog("Content truncated for API request (too long)");
      }
      
      // Get all existing tags from contacts for the prompt
      chrome.storage.local.get(['contacts'], function(result) {
        const contacts = result.contacts || [];
        let existingTags = [];
        
        // Extract all tags from contacts
        if (contacts.length > 0) {
          // Gather all tags from all contacts
          contacts.forEach(contact => {
            if (contact.tags && contact.tags.length > 0) {
              existingTags = existingTags.concat(contact.tags);
            }
          });
          
          // Remove duplicates and make lowercase for consistent matching
          existingTags = [...new Set(existingTags.map(tag => tag.toLowerCase()))];
          
          addDebugLog(`Found ${existingTags.length} unique tags from contacts`);
        } else {
          addDebugLog("No contacts with tags found");
        }
        
        // Prepare the OpenAI request with the list of existing tags
        const tagListForPrompt = existingTags.length > 0 
          ? existingTags.join(", ") 
          : "No existing tags found - please generate appropriate tags";
        
        // Prepare the request to OpenAI API
        const requestBody = {
          model: "gpt-3.5-turbo", // Using 3.5 for cost efficiency
          messages: [
            {
              role: "system", 
              content: `You are an expert content analyzer. From the provided article, identify tags that match ONLY the following existing tags in the CRM system: ${tagListForPrompt}. Return ONLY a comma-separated list of matching tags from this list, no explanations or other text. Return between 1-5 most relevant matching tags. If no relevant matches, return an empty response.`
            },
            {
              role: "user",
              content: `Analyze this article content and return ONLY relevant tags from the provided list as a comma-separated list:\n\n${textToAnalyze}`
            }
          ],
          temperature: 0.3, // Low temperature for more predictable results
          max_tokens: 100 // Limit response size
        };
        
        // Make request to OpenAI API
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        })
        .then(response => {
          if (!response.ok) {
            // Handle common API errors
            if (response.status === 401) {
              throw new Error("API key is invalid or expired. Please check your OpenAI API key.");
            } else if (response.status === 429) {
              throw new Error("OpenAI API rate limit exceeded. Please try again later.");
            } else if (response.status === 500) {
              throw new Error("OpenAI server error. Please try again later.");
            }
            throw new Error(`API request failed with status ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Extract the tags from response
          const tagsResponse = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content.trim()
            : '';
          
          if (!tagsResponse) {
            addDebugLog("No matching tags found from API");
            classificationBanner.textContent = "No matching tags found for this content";
            classificationBanner.style.backgroundColor = '#fff8e1';
            classificationBanner.style.color = '#f57f17';
            classificationBanner.style.border = '1px solid #ffe082';
            populateTagsList('');
            
            // Reset tag input placeholder
            document.getElementById('tag-input').placeholder = 'Type a tag and press Enter';
            
            classificationInProgress = false;
            return;
          }
          
          addDebugLog(`OpenAI generated tags: ${tagsResponse}`);
          
          // Update the UI with the tags
          populateTagsList(tagsResponse);
          
          // Update banner to show success
          classificationBanner.textContent = "Content tagged successfully!";
          classificationBanner.style.backgroundColor = '#e8f5e9';
          classificationBanner.style.color = '#2e7d32';
          classificationBanner.style.border = '1px solid #a5d6a7';
          
          // Reset tag input placeholder
          document.getElementById('tag-input').placeholder = 'Type a tag and press Enter';
          
          // Show the tags section explicitly if it was hidden
          document.getElementById('tag-article-container').style.display = 'block';
          
          // Automatically run the contact matching with these tags
          const tags = getTagsFromList();
          
          if (tags.length > 0) {
            addDebugLog(`Automatically matching contacts with ${tags.length} tags`);
            
            // Get contacts from storage and match them
            chrome.storage.local.get(['contacts'], function(result) {
              if (result.contacts && result.contacts.length > 0) {
                const matchedContacts = findMatchingContacts(tags, result.contacts);
                displayMatchedContacts(matchedContacts);
                
                if (matchedContacts.length > 0) {
                  addStatusBanner(`We found ${matchedContacts.length} contacts that might find this interesting!`, 'success');
                } else {
                  addStatusBanner("No contacts found for this content", 'warning');
                }
              } else {
                document.getElementById('matched-contacts').style.display = 'block';
                document.getElementById('matched-contacts-list').innerHTML = '<div class="contact-item">No contacts available. Please upload a contacts CSV file.</div>';
              }
            });
          }
          
          classificationInProgress = false;
        })
        .catch(error => {
          addDebugLog(`Error classifying content: ${error.message}`, true);
          
          // Update banner to show error
          classificationBanner.textContent = "Error tagging content: " + error.message;
          classificationBanner.style.backgroundColor = '#ffebee';
          classificationBanner.style.color = '#c62828';
          classificationBanner.style.border = '1px solid #ef9a9a';
          
          // Reset tag input placeholder
          document.getElementById('tag-input').placeholder = 'Type a tag and press Enter';
          
          // Show API key container if it seems like an authentication issue
          if (error.message.includes("API key") || error.message.includes("401")) {
            document.getElementById('api-key-container').classList.remove('hidden');
            addStatusBanner("Please check your OpenAI API key and try again", 'error');
          }
          
          // Add a retry button to the banner
          const retryButton = document.createElement('button');
          retryButton.textContent = "Retry Classification";
          retryButton.style.marginTop = "10px";
          retryButton.style.padding = "5px 10px";
          retryButton.style.fontSize = "12px";
          retryButton.style.backgroundColor = "#f1f1f1";
          retryButton.style.border = "1px solid #ddd";
          retryButton.style.borderRadius = "4px";
          retryButton.style.cursor = "pointer";
          
          retryButton.addEventListener('click', function() {
            // Get the latest API key before retrying
            chrome.storage.local.get(['openai_api_key'], function(result) {
              if (result.openai_api_key) {
                classificationBanner.remove(); // Remove old banner
                classifyContent(contentData, result.openai_api_key);
              } else {
                addStatusBanner("Please enter your OpenAI API key first", 'warning');
              }
            });
          });
          
          classificationBanner.appendChild(retryButton);
          
          classificationInProgress = false;
        });
      });
    }
});