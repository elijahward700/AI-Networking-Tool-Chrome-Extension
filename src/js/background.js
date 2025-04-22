chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "debug") {
      console.log("Debug message from content/popup:", message.data);
    } else if (message.action === "captureMainFrameContent") {
      // This action is triggered when we detect we're in an iframe on an article page
      // and want to capture the content of the main page instead
      
      console.log("Received request to capture main frame content instead of iframe");
      
      // Get the current tab ID
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
          const currentTabId = tabs[0].id;
          
          // Execute a content script in the main frame of the page
          chrome.scripting.executeScript({
            target: {tabId: currentTabId, allFrames: false}, // Only in main frame
            function: captureMainFrameContent,
          }, (results) => {
            if (results && results[0] && results[0].result) {
              sendResponse({
                status: "success", 
                data: results[0].result
              });
            } else {
              sendResponse({
                status: "error",
                error: "Failed to capture main frame content"
              });
            }
          });
        } else {
          sendResponse({
            status: "error",
            error: "No active tab found"
          });
        }
      });
      
      // Return true to indicate we'll respond asynchronously
      return true;
    }
    return false;
  });

// Function to be injected into the main frame to capture its content
function captureMainFrameContent() {
  // This function runs in the context of the main frame
  console.log("Executing main frame content capture");
  
  // First check if we're in an iframe or ad container
  if (window.top !== window.self) {
    console.log("We're in an iframe, but executing in the main document context");
  }
  
  // Check specifically for SafeFrame containers which are commonly used for ads
  if (document.querySelector('iframe[src*="safeframe"]') || 
      document.querySelector('iframe[sandbox]') ||
      document.querySelector('iframe[data-google-container-id]')) {
    console.log("Detected SafeFrame ad containers, will skip these when looking for content");
  }
  
  // Always try the ultra-simplified approach first
  const simpleExtraction = simpleArticleCapture();
  
  if (simpleExtraction.success) {
    console.log("Ultra-simplified article extraction successful!");
    return {
      title: simpleExtraction.title,
      url: window.location.href,
      textContent: simpleExtraction.textContent,
      contentFound: true,
      source: "Ultra-simplified extraction"
    };
  }
  
  // If ultra-simplified approach failed, try direct extraction
  console.log("Ultra-simplified approach failed, trying direct article extraction");
  
  // Just grab all paragraphs from the body directly
  const paragraphs = document.body.querySelectorAll('p');
  const paragraphTexts = [];
  
  for (const p of paragraphs) {
    const text = p.textContent.trim();
    if (text && text.length > 20) {
      paragraphTexts.push(text);
    }
  }
  
  if (paragraphTexts.length > 0) {
    console.log("Found article text from direct body paragraph extraction");
    return {
      title: document.title || "Captured Article",
      url: window.location.href, 
      textContent: paragraphTexts.join('\n\n'),
      contentFound: true,
      source: "Direct body paragraph extraction"
    };
  }
  
  // Last resort: try using the Readability algorithm
  console.log("Direct extraction failed, trying Readability as last resort");
  
  try {
    const readabilityResult = extractArticleWithReadabilityEnhanced();
    
    if (readabilityResult && readabilityResult.element) {
      console.log("Found article content using Readability algorithm");
      
      // Extract text content from the readability element
      const articleElement = readabilityResult.element;
      const title = readabilityResult.title || document.title || "Captured Article";
      
      // Get content
      const paragraphs = articleElement.querySelectorAll('p');
      const headings = articleElement.querySelectorAll('h1, h2, h3');
      
      let textContent = [];
      
      // Extract headings
      for (const heading of headings) {
        const text = heading.textContent.trim();
        if (text) {
          textContent.push(`${heading.tagName}: ${text}`);
        }
      }
      
      // Extract paragraphs
      for (const paragraph of paragraphs) {
        const text = paragraph.textContent.trim();
        if (text && text.length > 20) {
          textContent.push(text);
        }
      }
      
      // If we found content, return it
      if (textContent.length > 0) {
        return {
          title: title,
          url: window.location.href,
          textContent: textContent.join('\n\n'),
          contentFound: true,
          source: "Readability algorithm (last resort)"
        };
      }
    }
  } catch (e) {
    console.error("Error in Readability extraction:", e);
  }
  
  // Absolute last resort: just grab all text from the body
  console.log("All extraction methods failed, grabbing all body text as last resort");
  
  const bodyText = document.body.innerText;
  if (bodyText && bodyText.length > 100) {
    // Filter lines to only include those with reasonable length
    const textLines = bodyText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 20);
    
    if (textLines.length > 0) {
      return {
        title: document.title || "Captured Article",
        url: window.location.href,
        textContent: textLines.join('\n\n'),
        contentFound: true,
        source: "Full body text extraction (last resort)"
      };
    }
  }
  
  // Nothing worked
  return {
    title: document.title || "No Content",
    url: window.location.href,
    textContent: "Could not extract any content from this page.",
    contentFound: false,
    source: "No extraction method succeeded"
  };
}

// Enhanced version of extractArticleWithReadability with better ad skipping
function extractArticleWithReadabilityEnhanced() {
  console.log("Starting enhanced Readability-inspired article extraction");
  
  try {
    // Step 1: Create a clone of the document to avoid modifying the original
    const documentClone = document.cloneNode(true);
    
    // Step 2: Remove ads and unlikely candidates
    removeAdsAndUnlikelyCandidates(documentClone);
    
    // Step 3: Find all potential article containers
    const candidates = findCandidates(documentClone);
    
    // Step 4: Score candidates and pick the best one
    const bestCandidate = scoreCandidates(candidates);
    
    if (bestCandidate) {
      console.log("Readability found an article candidate");
      // Return a reference to the equivalent node in the actual document, not the clone
      const originalPath = getNodePath(bestCandidate);
      const originalElement = getElementByPath(originalPath, document);
      
      return {
        element: originalElement || null,
        title: getBestTitle(document),
        score: bestCandidate._readabilityScore || 0
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error in enhanced Readability algorithm:", error);
    return null;
  }
  
  // Helper function to remove ads and other unlikely content elements
  function removeAdsAndUnlikelyCandidates(doc) {
    // Enhanced selectors for ad detection and removal
    const unlikelySelectors = [
      // Ad-specific selectors
      'iframe[src*="safeframe"]',
      'iframe[sandbox]',
      'iframe[data-google-container-id]', 
      'div[id*="google_ads"]',
      'div[id*="div-gpt-ad"]',
      'div[class*="ad-"]',
      'div[class*="-ad"]',
      'div[class*="advert"]',
      'div[id*="ad-"]',
      'div[id*="-ad"]',
      'div[data-ad]',
      'ins.adsbygoogle',
      '.GoogleActiveViewElement',
      '[id*="taboola"]',
      '[id*="outbrain"]',
      '[id*="doubleclick"]',
      '[class*="sponsor"]',
      
      // Standard non-content elements
      'aside', 'footer', 'nav',
      '[role="complementary"]',
      '[role="navigation"]',
      '[role="banner"]',
      '.sidebar',
      '.comment',
      '.ad', '.ads', '.advertisement',
      '.promo',
      '.social',
      '.share',
      '.related',
      '.recommended',
      '.popup',
      '.cookie',
      '.newsletter',
      '.subscription',
      '.menu', '.nav',
      '.header', '.footer',
      '.breadcrumb',
      '.widget',
      '#sidebar', '#header', '#footer', '#nav'
    ];
    
    try {
      const elementsToRemove = doc.querySelectorAll(unlikelySelectors.join(','));
      elementsToRemove.forEach(el => {
        try {
          el.parentNode?.removeChild(el);
        } catch (e) {
          console.warn("Could not remove unlikely element");
        }
      });
    } catch (error) {
      console.warn("Error removing unlikely candidates");
    }
  }
  
  // Find potential article candidates
  function findCandidates(doc) {
    const candidateSelectors = [
      'article',
      '[role="article"]',
      '.article',
      '.post',
      '.content',
      '.story',
      '.main',
      'main',
      '[itemprop="articleBody"]',
      '.entry-content',
      '.post-content',
      '.article-content',
      '.article__content',
      '.article-body',
      '.article__body',
      '.story-body',
      '.story-content',
      '#content',
      '.content',
      '.main-content',
      '#main'
    ];
    
    const candidates = [];
    
    // First, try the specific article selectors
    try {
      for (const selector of candidateSelectors) {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.textContent.trim().length > 200) {
            candidates.push(el);
          }
        });
      }
    } catch (error) {
      console.warn("Error finding candidates with selectors");
    }
    
    // If no specific candidates were found, look at all divs and sections with substantial text
    if (candidates.length === 0) {
      try {
        const allElements = doc.querySelectorAll('div, section');
        allElements.forEach(el => {
          if (el.textContent.trim().length > 500) {
            candidates.push(el);
          }
        });
      } catch (error) {
        console.warn("Error finding fallback candidates");
      }
    }
    
    return candidates;
  }
  
  // Score candidates based on content quality
  function scoreCandidates(candidates) {
    let highestScore = 0;
    let bestCandidate = null;
    
    for (const candidate of candidates) {
      // Skip elements that are too small
      if (candidate.textContent.trim().length < 200) {
        continue;
      }
      
      // Calculate article score
      const score = calculateReadabilityScore(candidate);
      candidate._readabilityScore = score;
      
      if (score > highestScore) {
        highestScore = score;
        bestCandidate = candidate;
      }
    }
    
    // If no good candidate found, try to find the element with the most paragraph text
    if (!bestCandidate || highestScore < 20) {
      console.log("No good candidates found, looking for element with most paragraph text");
      let mostParagraphText = 0;
      
      for (const candidate of candidates) {
        const paragraphs = candidate.querySelectorAll('p');
        let paragraphText = 0;
        
        paragraphs.forEach(p => {
          paragraphText += p.textContent.trim().length;
        });
        
        if (paragraphText > mostParagraphText) {
          mostParagraphText = paragraphText;
          bestCandidate = candidate;
          bestCandidate._readabilityScore = 10 + (paragraphText / 100);
        }
      }
    }
    
    return bestCandidate;
  }
  
  // Calculate article score based on multiple content quality factors
  function calculateReadabilityScore(element) {
    let score = 0;
    
    // 1. Text length is a primary indicator
    const text = element.textContent.trim();
    score += Math.min(text.length / 100, 25); // Up to 25 points for text length
    
    // 2. Count paragraphs - articles usually have multiple paragraphs
    const paragraphs = element.querySelectorAll('p');
    score += Math.min(paragraphs.length * 2, 50); // Up to 50 points for paragraphs
    
    // 3. Favor paragraphs with substantial content
    let meaningfulParagraphs = 0;
    paragraphs.forEach(p => {
      const length = p.textContent.trim().length;
      if (length > 40) meaningfulParagraphs++;
      if (length > 80) meaningfulParagraphs++;
    });
    score += Math.min(meaningfulParagraphs * 2, 30); // Up to 30 points for meaningful paragraphs
    
    // 4. Check for presence of headings (common in articles)
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    score += Math.min(headings.length * 5, 25); // Up to 25 points for headings
    
    // 5. Check for images and figures (common in articles)
    const images = element.querySelectorAll('img');
    const figures = element.querySelectorAll('figure');
    score += Math.min((images.length + figures.length) * 3, 15); // Up to 15 points for images/figures
    
    // 6. Check for blockquotes (often used in articles)
    const blockquotes = element.querySelectorAll('blockquote');
    score += blockquotes.length * 5; // 5 points per blockquote
    
    // 7. Check for article metadata
    if (element.querySelector('time') || 
        element.querySelector('[datetime]') ||
        element.querySelector('.author') ||
        element.querySelector('.byline') ||
        element.querySelector('[itemprop="author"]') ||
        element.querySelector('[rel="author"]')) {
      score += 20; // Significant bonus for article metadata
    }
    
    // 8. Penalize high link density (navigation elements)
    const links = element.querySelectorAll('a');
    if (links.length > 0) {
      const linkDensity = links.length / text.length;
      if (linkDensity > 0.1) {
        score -= Math.min(linkDensity * 200, 50); // Up to 50 point penalty for high link density
      }
    }
    
    // 9. Penalize too many non-paragraph elements (likely navigation or other UI)
    const nonContentElements = element.querySelectorAll('button, input, nav, aside, form');
    score -= nonContentElements.length * 3; // 3 point penalty per UI element
    
    // 10. Award bonus for common article classes/ids/attributes
    const articleIndicators = [
      'article', 'story', 'post', 'content', 'entry', 'main', 'text'
    ];
    
    const classes = element.className?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    
    for (const indicator of articleIndicators) {
      if (classes.includes(indicator) || id.includes(indicator)) {
        score += 15; // Bonus for article-like class/id
        break;
      }
    }
    
    return score;
  }
  
  // Find the best title for the article
  function getBestTitle(doc) {
    // 1. First try <h1> inside article
    const articleH1 = doc.querySelector('article h1, [role="article"] h1, .article h1');
    if (articleH1 && articleH1.textContent.trim().length > 0) {
      return articleH1.textContent.trim();
    }
    
    // 2. Try the first <h1> with substantial text
    const mainH1s = Array.from(doc.querySelectorAll('h1'))
      .filter(h => h.textContent.trim().length > 10);
    
    if (mainH1s.length > 0) {
      return mainH1s[0].textContent.trim();
    }
    
    // 3. Try Open Graph title
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.getAttribute('content')) {
      return ogTitle.getAttribute('content').trim();
    }
    
    // 4. Fallback to document title
    return doc.title;
  }
  
  // Helper function to get a unique path to a DOM node
  function getNodePath(node) {
    const path = [];
    while (node && node.parentNode) {
      const siblings = Array.from(node.parentNode.children);
      const index = siblings.indexOf(node);
      path.unshift(index);
      node = node.parentNode;
    }
    return path;
  }
  
  // Helper function to find a node by its path
  function getElementByPath(path, doc) {
    let currentNode = doc;
    for (const index of path) {
      if (currentNode.children && index >= 0 && index < currentNode.children.length) {
        currentNode = currentNode.children[index];
      } else {
        return null;
      }
    }
    return currentNode;
  }
}

// Simple extraction of article text - directly find paragraphs with content
function simpleArticleCapture() {
  try {
    console.log("Trying ultra-simplified article extraction");
    
    // Basic info
    const title = document.title || "Captured Article";
    
    // ULTRA SIMPLIFIED APPROACH: Just get all visible paragraphs directly
    console.log("Getting all visible paragraphs directly");
    
    // Get all paragraphs
    const paragraphs = document.querySelectorAll('p');
    const paragraphTexts = [];
    
    // Process only visible paragraphs with substantial content
    paragraphs.forEach(p => {
      if (p.offsetWidth > 0 && p.offsetHeight > 0) {
        const text = p.textContent.trim();
        if (text && text.length > 20) {
          paragraphTexts.push(text);
        }
      }
    });
    
    // Get important headings
    const headings = document.querySelectorAll('h1, h2, h3');
    const headingTexts = [];
    
    headings.forEach(h => {
      if (h.offsetWidth > 0 && h.offsetHeight > 0) {
        const text = h.textContent.trim();
        if (text) {
          headingTexts.push(`${h.tagName}: ${text}`);
        }
      }
    });
    
    // Combine headings and paragraphs
    let textContent = '';
    if (headingTexts.length > 0) {
      textContent += headingTexts.join('\n\n') + '\n\n';
    }
    if (paragraphTexts.length > 0) {
      textContent += paragraphTexts.join('\n\n');
    }
    
    if (textContent.length > 100) {
      return {
        success: true,
        title: title,
        textContent: textContent
      };
    }
    
    // No paragraphs found, try raw text extraction
    console.log("No paragraphs found, trying raw text extraction");
    
    // Get body text
    const bodyText = document.body.innerText;
    if (bodyText && bodyText.length > 100) {
      // Split by newlines and filter out short lines
      const textLines = bodyText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 20);
      
      if (textLines.length > 0) {
        return {
          success: true,
          title: title,
          textContent: textLines.join('\n\n')
        };
      }
    }
    
    return { success: false };
  } catch (error) {
    console.error("Error in simple article extraction:", error);
    return { success: false };
  }
}