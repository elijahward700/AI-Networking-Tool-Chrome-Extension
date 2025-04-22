// content.js
console.log("Content Capture script loaded");

// **NEW: Add log immediately to confirm script injection**
console.log(`[Content Script] ${window.location.href} - Script loaded and running.`);

// Track ongoing operation
let captureInProgress = false;

// Helper function to escape HTML special characters
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Readability-inspired article extraction algorithm
function extractArticleWithReadability() {
  console.log("Starting Readability-inspired article extraction");
  
  try {
    // Step 1: Create a clone of the document to avoid modifying the original
    const documentClone = document.cloneNode(true);
    
    // Step 2: Remove unlikely candidates
    removeUnlikelyCandidates(documentClone);
    
    // Step 3: Find all potential article containers (div, article, section elements)
    const candidates = findCandidates(documentClone);
    
    // Step 4: Score candidates and pick the best one
    const bestCandidate = scoreCandidates(candidates);
    
    if (bestCandidate) {
      console.log("Readability found an article candidate:", bestCandidate);
      // Return a reference to the equivalent node in the actual document, not the clone
      const originalPath = getNodePath(bestCandidate);
      const originalElement = getElementByPath(originalPath, document);
      
      return {
        element: originalElement || null,
        title: getBestTitle(document),
        score: bestCandidate._readabilityScore || 0,
        method: "readability"
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error in Readability algorithm:", error);
    return null;
  }
  
  // Helper function to remove elements unlikely to be article content
  function removeUnlikelyCandidates(doc) {
    // Selectors for elements that are likely NOT part of the article content
    const unlikelySelectors = [
      'aside', 'footer', 'nav',
      '[role="complementary"]',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="form"]',
      '.sidebar',
      '.comment',
      '.ad', '.ads', '.advertisement',
      '.promo', '.promotion',
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
      '.combx', '.comment',
      '.commercial', '.shop', '.shopping',
      '.community',
      '.disqus', 
      '#sidebar', '#header', '#footer', '#nav'
    ];
    
    try {
      // Query and remove unlikely elements from the clone
      const elementsToRemove = doc.querySelectorAll(unlikelySelectors.join(','));
      elementsToRemove.forEach(el => {
        try {
          el.parentNode?.removeChild(el);
        } catch (e) {
          console.warn("Could not remove unlikely element:", e);
        }
      });
    } catch (error) {
      console.warn("Error removing unlikely candidates:", error);
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
      '.entry',
      '.body',
      '#content',
      '.content',
      'div[class*="content"]',
      'div[class*="article"]',
      'div[class*="story"]',
      'div[class*="post"]',
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
      console.warn("Error finding candidates with selectors:", error);
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
        console.warn("Error finding fallback candidates:", error);
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
      console.log("No good candidates found, trying to find element with most paragraph text");
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
    
    console.log(`Readability score for ${getElementSelector(element)}: ${score.toFixed(2)} with ${paragraphs.length} paragraphs`);
    
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
    
    // 3. Try Open Graph title (used for social sharing)
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.getAttribute('content')) {
      return ogTitle.getAttribute('content').trim();
    }
    
    // 4. Try Twitter card title
    const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
    if (twitterTitle && twitterTitle.getAttribute('content')) {
      return twitterTitle.getAttribute('content').trim();
    }
    
    // 5. Fallback to document title
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

// Helper function to convert text content to HTML
function convertToHTML(title, url, content) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHTML(title)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 20px;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          color: #333;
        }
        header {
          margin-bottom: 30px;
          border-bottom: 1px solid #eee;
          padding-bottom: 20px;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .source {
          color: #666;
          font-size: 14px;
          margin-bottom: 5px;
        }
        .capture-date {
          color: #666;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .content {
          margin-top: 20px;
        }
        h2 {
          font-size: 20px;
          margin-top: 25px;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eee;
        }
        h3 {
          font-size: 18px;
          margin-top: 20px;
        }
        p {
          margin-bottom: 16px;
        }
        .list-item {
          margin-bottom: 8px;
          padding-left: 20px;
          position: relative;
        }
        .list-item:before {
          content: "•";
          position: absolute;
          left: 0;
        }
        @media print {
          body {
            font-size: 12pt;
          }
          h1 {
            font-size: 18pt;
          }
          h2 {
            font-size: 16pt;
          }
          h3 {
            font-size: 14pt;
          }
        }
      </style>
    </head>
    <body>
      <header>
        <h1>${escapeHTML(title)}</h1>
        <div class="source">Source: <a href="${escapeHTML(url)}">${escapeHTML(url)}</a></div>
        <div class="capture-date">Captured on: ${new Date().toLocaleString()}</div>
      </header>
      <div class="content">
        ${content}
      </div>
    </body>
    </html>
  `;
  
  return html;
}

// Find the main content area of the page
function findMainContent() {
  console.log("Starting main content detection");
  
  // First try the Readability algorithm as the primary method
  const readabilityResult = extractArticleWithReadability();
  
  if (readabilityResult && readabilityResult.element) {
    console.log(`Found article content using Readability algorithm with score ${readabilityResult.score.toFixed(2)}`);
    return readabilityResult.element;
  }
  
  // Readability failed, fall back to existing methods
  console.log("Readability algorithm didn't find high-quality article content, falling back to selector-based approaches");
  
  // Common article selectors - in order of specificity/likelihood
  const articleSelectors = [
    // Article specific selectors
    'article',
    '[role="article"]',
    '.article',
    '.article-content',
    '.article-body',
    '.article__body',
    '.article__content',
    '.article-container',
    '.article__container',
    '.story-body',
    '.story-content',
    '.news-article',
    '.post-content',
    '.entry-content',
    
    // Main content area selectors
    'main',
    '[role="main"]',
    '#main-content',
    '#mainContent',
    '#content-main',
    '.main-content',
    '.main-article',
    '.content-article',
    
    // Generic content containers
    '#content',
    '.content',
    '#main',
    '.main',
    '.post',
    '.page-content'
  ];
  
  // Helper function to score potential article content
  function scoreArticleContent(element) {
    if (!element) return 0;
    
    let score = 0;
    const text = element.textContent.trim();
    const html = element.innerHTML;
    
    // Base score on text length
    score += Math.min(text.length / 100, 10); // Up to 10 points for text length
    
    // Article-like structure indicators
    const paragraphs = element.querySelectorAll('p');
    score += Math.min(paragraphs.length, 20); // Up to 20 points for paragraphs
    
    // Check for headings
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    score += headings.length * 2; // 2 points per heading
    
    // Check for images with captions (common in articles)
    const images = element.querySelectorAll('img');
    const figcaptions = element.querySelectorAll('figcaption');
    score += Math.min(images.length, 5); // Up to 5 points for images
    score += figcaptions.length * 2; // 2 points per caption (strong article indicator)
    
    // Check text to HTML ratio (articles tend to have higher text ratio)
    const textToHtmlRatio = text.length / (html.length || 1);
    score += textToHtmlRatio * 20; // Up to 20 points for text:HTML ratio
    
    // Penalize for too many links (likely navigation area)
    const links = element.querySelectorAll('a');
    const linkDensity = links.length / (paragraphs.length || 1);
    if (linkDensity > 1.5) {
      score -= 10 * linkDensity; // Penalty for high link density
    }
    
    // Bonus for article metadata elements
    if (element.querySelector('time') || 
        element.querySelector('[datetime]') ||
        element.querySelector('.author') ||
        element.querySelector('.byline')) {
      score += 10; // Bonus for article metadata
    }
    
    // Check for common article structural elements
    if (element.querySelector('blockquote') || 
        element.querySelector('cite') ||
        element.querySelector('figure')) {
      score += 10; // Bonus for article elements
    }
    
    console.log(`Scored element ${getElementSelector(element)}: ${score.toFixed(2)} points (${paragraphs.length} paragraphs, ${text.length} chars)`);
    
    return score;
  }
  
  // First try the article selectors
  for (const selector of articleSelectors) {
    try {
    const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 200) {
        // Only accept if the element appears to have article content
        const score = scoreArticleContent(element);
        if (score > 30) { // Threshold for accepting as an article
          console.log(`Found article content using selector: ${selector} with score ${score.toFixed(2)}`);
      return element;
        }
      }
    } catch (err) {
      console.warn(`Error checking selector ${selector}:`, err);
    }
  }
  
  // If selectors didn't find a good match, try content scoring approach
  console.log("Standard selectors didn't find high-quality article content, trying content scoring approach");
  
  // Find elements with substantial content and score them
  const contentCandidates = [];
  
  // Look for elements with reasonable article-like content
  const potentialElements = document.querySelectorAll('div, section, main, article');
  for (const element of potentialElements) {
    const text = element.textContent.trim();
    // Only consider elements with reasonable amounts of text
    if (text.length > 300) {
      const score = scoreArticleContent(element);
      contentCandidates.push({
        element,
        score,
        textLength: text.length
      });
    }
  }
  
  // Sort by score (higher is better)
  contentCandidates.sort((a, b) => b.score - a.score);
  
  if (contentCandidates.length > 0 && contentCandidates[0].score > 20) {
    console.log(`Found article content by scoring, best element score: ${contentCandidates[0].score.toFixed(2)}`);
    return contentCandidates[0].element;
  }
  
  // If content scoring didn't work, fall back to the density approach from original code
  console.log("Content scoring approach failed, trying text density approach");
  
  // Look for the element with the most text content per DOM node
  const contentElements = [];
  const minContentLength = 200; // Minimum text length to consider
  
  // Helper to calculate text density (text length per DOM node)
  function getTextDensity(element) {
    const text = element.textContent.trim();
    const nodeCount = element.querySelectorAll('*').length || 1;
    return {
      element,
      textLength: text.length,
      nodeCount,
      density: text.length / nodeCount,
      text
    };
  }
  
  // Gather potential content elements with substantial text
  for (const element of potentialElements) {
    const text = element.textContent.trim();
    if (text.length > minContentLength) {
      contentElements.push(getTextDensity(element));
    }
  }
  
  // Sort by density (higher is better)
  contentElements.sort((a, b) => b.density - a.density);
  
  if (contentElements.length > 0) {
    console.log(`Found ${contentElements.length} potential content elements by density`);
    console.log(`Top element density: ${contentElements[0].density.toFixed(2)}, length: ${contentElements[0].textLength}`);
    return contentElements[0].element;
  }
  
  // If density approach fails, just try to grab the largest text block
  console.log("Density approach failed, trying largest text block approach");
  const paragraphs = document.querySelectorAll('p');
  if (paragraphs.length > 3) {
    // Find paragraph with most text
    let bestParagraph = null;
    let maxLength = 0;
    
    paragraphs.forEach(p => {
      const length = p.textContent.trim().length;
      if (length > maxLength) {
        maxLength = length;
        bestParagraph = p;
      }
    });
    
    if (bestParagraph && bestParagraph.parentElement) {
      console.log(`Found content using parent of largest paragraph, text length: ${maxLength}`);
      return bestParagraph.parentElement;
    }
  }
  
  // Last resort: use the body but log a warning
  console.warn("All content detection methods failed, falling back to document.body");
  return document.body;
}

// Extract content in simplified text-only mode
function extractSimplifiedContent(container) {
  let contentHtml = '';
  
  // Extract headings and paragraphs only
  const elements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
  
  elements.forEach(element => {
    const text = element.textContent.trim();
    if (!text) return;
    
    if (element.tagName.toLowerCase().startsWith('h')) {
      contentHtml += `<${element.tagName.toLowerCase()}>${escapeHTML(text)}</${element.tagName.toLowerCase()}>`;
    } else {
      contentHtml += `<p>${escapeHTML(text)}</p>`;
    }
  });
  
  return contentHtml;
}

// Extract more detailed content including lists and basic formatting
function extractDetailedContent(container) {
  let contentHtml = '';
  let headingCount = 0;
  
  // Process nodes recursively
  function processNode(node, depth = 0) {
    if (depth > 10) return ''; // Prevent too deep recursion
    
    // Skip invisible elements and scripts
    if (node.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return '';
      }
      
      const tagName = node.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'iframe', 'canvas', 'svg'].includes(tagName)) {
        return '';
      }
    }
    
    // Process text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        return escapeHTML(text);
      }
      return '';
    }
    
    // Process element nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Process headings
      if (tagName.match(/^h[1-6]$/)) {
        headingCount++;
        const headingText = node.textContent.trim();
        if (headingText) {
          return `<${tagName}>${escapeHTML(headingText)}</${tagName}>`;
        }
        return '';
      }
      
      // Process paragraphs
      if (tagName === 'p') {
        const paragraphText = node.textContent.trim();
        if (paragraphText) {
          return `<p>${escapeHTML(paragraphText)}</p>`;
        }
        return '';
      }
      
      // Process lists
      if (tagName === 'ul' || tagName === 'ol') {
        let listItems = '';
        for (const child of node.children) {
          if (child.tagName.toLowerCase() === 'li') {
            const listItemText = child.textContent.trim();
            if (listItemText) {
              listItems += `<div class="list-item">${escapeHTML(listItemText)}</div>`;
            }
          }
        }
        if (listItems) {
          return `<div class="list-container">${listItems}</div>`;
        }
        return '';
      }
      
      // Process tables simply as text
      if (tagName === 'table') {
        const tableText = node.textContent.trim().replace(/\s+/g, ' ');
        if (tableText) {
          return `<p><strong>Table content:</strong> ${escapeHTML(tableText)}</p>`;
        }
        return '';
      }
      
      // Process children recursively
      let childContent = '';
      for (const child of node.childNodes) {
        childContent += processNode(child, depth + 1);
      }
      return childContent;
    }
    
    return '';
  }
  
  // Process the entire container
  contentHtml = processNode(container);
  
  // If no headings were found, add a default one
  if (headingCount === 0) {
    contentHtml = '<h2>Page Content</h2>' + contentHtml;
  }
  
  return contentHtml;
}

// Extract plain text content for API classification with options
function extractPlainTextContent(container, options = {}) {
  console.time('extractPlainTextContent');
  // Default options for extraction
  const defaultOptions = {
    lightweight: false,
    maxParagraphs: 1000,
    skipMetadata: false,
    maxHeadings: 100
  };
  
  // Merge default options with provided options
  const extractOptions = {...defaultOptions, ...options};
  
  // First, get the title and basic metadata
  const title = document.title || "Captured Page";
  const url = window.location.href;
  let textContent = `Title: ${title}\nURL: ${url}\n\n`;
  
  // Check if the container is extremely large and might cause performance issues
  const containerSize = container.innerHTML.length;
  const isVeryLarge = containerSize > 500000 || extractOptions.lightweight; // Consider > 500KB as very large or use lightweight mode
  
  if (isVeryLarge) {
    console.warn(`Very large content or lightweight mode enabled. Content size: ${containerSize} bytes. Using restricted extraction.`);
    textContent += `[NOTE: Using optimized extraction mode for better performance.]\n\n`;
  }
  
  // Extract the main text content
  try {
    // Collect all visible text content by element type
    console.time('collectTextContent');
    
    // For tracking which content we've processed
    const processedTextBlocks = new Set();
    
    // Extract headings
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingCount = headings.length;
    
    // Limit the number of headings based on options
    const maxHeadings = isVeryLarge ? Math.min(extractOptions.maxHeadings, 50) : extractOptions.maxHeadings;
    const headingsToProcess = headings.length > maxHeadings ? 
      Array.from(headings).slice(0, maxHeadings) : 
      headings;
    
    headingsToProcess.forEach(heading => {
      const text = heading.textContent.trim();
      if (text && !processedTextBlocks.has(text)) {
        textContent += `${text}\n`;
        processedTextBlocks.add(text);
      }
    });
    
    textContent += '\n';
    
    // Get paragraphs
    const paragraphs = container.querySelectorAll('p');
    const paragraphCount = paragraphs.length;
    
    // Limit the number of paragraphs based on options
    const maxParagraphs = isVeryLarge ? Math.min(extractOptions.maxParagraphs, 200) : extractOptions.maxParagraphs;
    const paragraphsToProcess = paragraphs.length > maxParagraphs ? 
      Array.from(paragraphs).slice(0, maxParagraphs) : 
      paragraphs;
    
    // Add warning if content was truncated
    if (paragraphs.length > maxParagraphs) {
      textContent += `[NOTE: Content truncated for performance. Showing ${maxParagraphs} of ${paragraphs.length} paragraphs.]\n\n`;
    }
    
    paragraphsToProcess.forEach(paragraph => {
      const text = paragraph.textContent.trim();
      if (text && !processedTextBlocks.has(text) && text.length > 10) {
        textContent += `${text}\n\n`;
        processedTextBlocks.add(text);
      }
    });
    
    // If we got very little content so far, try other elements
    if (textContent.length < 500) {
      console.log("Limited content from headings/paragraphs, trying additional elements");
      
      // Try divs that might contain text
      const divs = container.querySelectorAll('div');
      let addedDivs = 0;
      
      for (const div of divs) {
        // Only process divs with direct text and not just whitespace
        const hasDirectText = Array.from(div.childNodes).some(
          node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 20
        );
        
        if (hasDirectText) {
          const text = div.textContent.trim();
          if (text && !processedTextBlocks.has(text) && text.length > 30) {
            textContent += `${text}\n\n`;
            processedTextBlocks.add(text);
            addedDivs++;
            
            // Limit number of divs we add to avoid too much content
            if (addedDivs >= 20) break;
          }
        }
      }
      
      // Try list items
      const listItems = container.querySelectorAll('li');
      if (listItems.length > 0) {
        textContent += "List content:\n";
        
        for (let i = 0; i < Math.min(listItems.length, 50); i++) {
          const text = listItems[i].textContent.trim();
          if (text && !processedTextBlocks.has(text)) {
            textContent += `• ${text}\n`;
            processedTextBlocks.add(text);
          }
        }
        
        textContent += "\n";
      }
    }
    
    console.timeEnd('collectTextContent');
    
    // Skip metadata extraction if requested
    if (!extractOptions.skipMetadata) {
      console.time('extractMetadata');
      // Try to get article metadata if available
      const metaTags = document.querySelectorAll('meta');
      let metaDescription = '';
      let metaKeywords = '';
      let metaAuthor = '';
      
      metaTags.forEach(meta => {
        const name = meta.getAttribute('name')?.toLowerCase();
        const property = meta.getAttribute('property')?.toLowerCase();
        
        if (name === 'description' || property === 'og:description') {
          metaDescription = meta.getAttribute('content') || '';
        }
        else if (name === 'keywords') {
          metaKeywords = meta.getAttribute('content') || '';
        }
        else if (name === 'author' || property === 'article:author') {
          metaAuthor = meta.getAttribute('content') || '';
        }
      });
      console.timeEnd('extractMetadata');
      
      // Add metadata to the text content
      if (metaDescription) {
        textContent += `Description: ${metaDescription}\n\n`;
      }
      
      if (metaKeywords) {
        textContent += `Keywords: ${metaKeywords}\n\n`;
      }
      
      if (metaAuthor) {
        textContent += `Author: ${metaAuthor}\n\n`;
      }
    } else {
      console.log('Skipping metadata extraction in lightweight mode');
    }
    
    // Final check - if we still don't have good content, extract text from body
    if (textContent.length < 300) {
      console.log("Limited content extracted, using raw text as last resort");
      const bodyText = document.body.innerText.trim();
      textContent += `\nComplete page text:\n${bodyText.substring(0, 10000)}\n`;
    }
    
    // Add some statistics for debugging
    textContent += `\n---\nExtraction Stats:\n`;
    textContent += `Headings: ${headingCount} (showing ${headingsToProcess.length})\n`;
    textContent += `Paragraphs: ${paragraphCount} (showing ${paragraphsToProcess.length})\n`;
    textContent += `Total Characters: ${textContent.length}\n`;
    textContent += `Extraction mode: ${isVeryLarge ? 'Optimized' : 'Standard'}\n`;
    
  } catch (e) {
    console.error('Error in text extraction:', e);
    textContent += `Error extracting content: ${e.message}\n`;
    
    // Even more aggressive fallback - just get any text we can find
    try {
      console.log("Attempting emergency fallback extraction");
      const bodyText = document.body.innerText.trim();
      
      if (bodyText.length > 200) {
        textContent += `\nEmergency Fallback Content:\n${bodyText.substring(0, 15000)}\n`;
      } else {
        // If we're dealing with a page that has almost no content
        textContent += "\nThis page appears to contain minimal content or may be a tracking pixel/beacon.";
        
        // Try to extract any visible text on the page as a last resort
        const allTextElements = document.querySelectorAll('*');
        for (const element of allTextElements) {
          const text = element.textContent.trim();
          if (text && text.length > 20) {
            textContent += `\nFound text: ${text}\n`;
          }
        }
      }
    } catch (fallbackError) {
      console.error("Even emergency fallback failed:", fallbackError);
      textContent += `\nCouldn't extract any meaningful content from this page.`;
    }
  }
  
  console.timeEnd('extractPlainTextContent');
  return textContent;
}

// Helper function to sanitize malformed HTML before processing
function sanitizeHtml(html) {
  // Use DOMParser to properly parse HTML and fix malformed tags
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove potentially problematic elements
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    const styles = doc.querySelectorAll('style');
    styles.forEach(style => style.remove());
    
    // Get the sanitized HTML
    return doc.documentElement.outerHTML;
  } catch (e) {
    console.error("Error sanitizing HTML:", e);
    return html; // Return original if parsing fails
  }
}

// Helper function to handle cross-origin iframe content
function handleCrossOriginContent() {
  // Check if we're in a cross-origin iframe
  try {
    // If we can access this without error, we're not in a cross-origin frame
    const test = window.top.location.href;
    return false;
  } catch (e) {
    console.log("Detected cross-origin iframe, using special handling");
    return true;
  }
}

// JavaScript implementation of HTML to text conversion (similar to html2text Python library)
function html2text(htmlContent) {
  // First sanitize the HTML to handle malformed tags
  htmlContent = sanitizeHtml(htmlContent);
  
  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Process various HTML elements appropriately
  
  // First, handle line breaks and paragraph spacing
  const brs = tempDiv.querySelectorAll('br');
  for (const br of brs) {
    br.replaceWith('\n');
  }
  
  // Handle paragraphs with proper spacing
  const paragraphs = tempDiv.querySelectorAll('p');
  for (const p of paragraphs) {
    // Add newlines after paragraphs
    if (!p.nextElementSibling || p.nextElementSibling.tagName !== 'P') {
      p.insertAdjacentText('afterend', '\n\n');
    }
  }
  
  // Process headings with proper formatting
  const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const heading of headings) {
    const level = parseInt(heading.tagName.substring(1));
    const prefix = '#'.repeat(level) + ' ';
    heading.insertAdjacentText('beforebegin', '\n\n');
    heading.insertAdjacentText('afterend', '\n\n');
    heading.textContent = prefix + heading.textContent;
  }
  
  // Handle lists
  const listItems = tempDiv.querySelectorAll('li');
  for (const li of listItems) {
    // Check if parent is ordered or unordered list
    const isOrdered = li.parentElement.tagName === 'OL';
    
    // Add proper list marker
    if (isOrdered) {
      const listIndex = Array.from(li.parentElement.children).indexOf(li) + 1;
      li.insertAdjacentText('beforebegin', `${listIndex}. `);
    } else {
      li.insertAdjacentText('beforebegin', '* ');
    }
    
    // Add newline after list item
    li.insertAdjacentText('afterend', '\n');
  }
  
  // Handle links - format as [text](url)
  const links = tempDiv.querySelectorAll('a');
  for (const link of links) {
    if (link.textContent && link.href) {
      const linkText = link.textContent.trim();
      const linkUrl = link.getAttribute('href');
      if (linkText && linkUrl) {
        // Replace the link with Markdown-style link
        const markdownLink = document.createTextNode(`[${linkText}](${linkUrl})`);
        link.replaceWith(markdownLink);
      }
    }
  }
  
  // Handle images - format as ![alt](src)
  const images = tempDiv.querySelectorAll('img');
  for (const img of images) {
    const altText = img.alt || 'Image';
    const src = img.getAttribute('src') || '';
    if (src) {
      const markdownImage = document.createTextNode(`![${altText}](${src})`);
      img.replaceWith(markdownImage);
    }
  }
  
  // Handle tables more effectively
  const tables = tempDiv.querySelectorAll('table');
  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    const textRows = [];
    
    // Process each row
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('th, td');
      const textCells = Array.from(cells).map(cell => cell.textContent.trim());
      
      // Add the text representation of the row
      if (textCells.length > 0) {
        textRows.push(`| ${textCells.join(' | ')} |`);
        
        // Add separator row after header
        if (rowIndex === 0 && row.querySelectorAll('th').length > 0) {
          textRows.push(`| ${Array(textCells.length).fill('---').join(' | ')} |`);
        }
      }
    });
    
    // Replace the table with its text representation
    if (textRows.length > 0) {
      const textTable = document.createTextNode('\n\n' + textRows.join('\n') + '\n\n');
      table.replaceWith(textTable);
    }
  }
  
  // Handle blockquotes
  const blockquotes = tempDiv.querySelectorAll('blockquote');
  for (const quote of blockquotes) {
    // Add "> " to the beginning of each line
    const lines = quote.textContent.split('\n');
    const quotedText = lines.map(line => `> ${line}`).join('\n');
    
    const textNode = document.createTextNode('\n\n' + quotedText + '\n\n');
    quote.replaceWith(textNode);
  }
  
  // Handle pre and code blocks
  const preBlocks = tempDiv.querySelectorAll('pre');
  for (const pre of preBlocks) {
    pre.insertAdjacentText('beforebegin', '\n\n```\n');
    pre.insertAdjacentText('afterend', '\n```\n\n');
  }
  
  // Remove script and style tags
  const scriptAndStyles = tempDiv.querySelectorAll('script, style');
  for (const element of scriptAndStyles) {
    element.remove();
  }
  
  // Get the clean text content
  let textContent = tempDiv.textContent || tempDiv.innerText;
  
  // Clean up multiple blank lines
  textContent = textContent.replace(/\n{3,}/g, '\n\n');
  
  // Trim extra whitespace
  textContent = textContent.trim();
  
  return textContent;
}

// Add a function to detect if we're in an ad iframe
function isInAdFrame() {
  // Check if we're in an iframe
  const isInIframe = window !== window.top;
  
  if (!isInIframe) return false;
  
  // Check if we're in a SafeFrame or ad-related iframe
  const url = window.location.href;
  const isSafeFrame = url.includes('safeframe') || 
                     document.documentElement.id === 'google_ads_iframe' ||
                     !!document.querySelector('body[marginwidth="0"][marginheight="0"]');
  
  return isSafeFrame;
}

// Direct article content extraction - simplified approach that just gets the text
function directArticleContentExtraction() {
  console.log("Starting direct article content extraction");
  
  try {
    // First check if we're in an iframe - if so, try to get out
    if (window !== window.top) {
      console.log("We're in an iframe - cannot access main content directly due to same-origin policy");
      return {
        success: false,
        reason: "iframe"
      };
    }
    
    // Get basic info
    const title = document.title || "";
    const url = window.location.href;
    
    // A simple but effective approach: find the element with the most paragraph content
    const paragraphContainers = [];
    const potentialContainers = ['article', 'main', '[role="main"]', '.article', '.content', '#content', '.post', '.entry', 'div'];
    
    // Try common article containers first
    for (const selector of potentialContainers) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          // Only consider visible elements with substantial content
          if (element.offsetWidth > 0 && element.offsetHeight > 0) {
            const paragraphs = element.querySelectorAll('p');
            if (paragraphs.length >= 3) {
              let textLength = 0;
              paragraphs.forEach(p => {
                textLength += p.textContent.trim().length;
              });
              
              if (textLength > 200) {
                paragraphContainers.push({
                  element: element,
                  paragraphCount: paragraphs.length,
                  textLength: textLength
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn(`Error checking ${selector}:`, e);
      }
    }
    
    // Sort by text length (most text first)
    paragraphContainers.sort((a, b) => b.textLength - a.textLength);
    
    // Get the best candidate
    const bestContainer = paragraphContainers.length > 0 ? paragraphContainers[0].element : null;
    
    if (bestContainer) {
      console.log(`Found content container with ${paragraphContainers[0].paragraphCount} paragraphs and ${paragraphContainers[0].textLength} characters`);
      
      // Extract headings
      const headings = [];
      const headingElements = bestContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headingElements.forEach(h => {
        const text = h.textContent.trim();
        if (text) {
          headings.push(`${h.tagName}: ${text}`);
        }
      });
      
      // Extract paragraphs
      const paragraphs = [];
      const paragraphElements = bestContainer.querySelectorAll('p');
      paragraphElements.forEach(p => {
        const text = p.textContent.trim();
        if (text && text.length > 20) { // Only substantial paragraphs
          paragraphs.push(text);
        }
      });
      
      // Combine content
      let textContent = '';
      if (headings.length > 0) {
        textContent += headings.join('\n\n') + '\n\n';
      }
      textContent += paragraphs.join('\n\n');
      
      return {
        success: true,
        title: title,
        url: url,
        textContent: textContent,
        source: "Direct extraction"
      };
    } else {
      // No good container found, try extracting from body
      console.log("No good container found, extracting directly from body");
      
      // Get all visible text blocks
      const textBlocks = [];
      const blockElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, div > text');
      
      blockElements.forEach(el => {
        // Only include visible elements with substantial text
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
          const text = el.textContent.trim();
          if (text.length > 20) {
            // Check if element is not in a hidden container
            let parent = el.parentElement;
            let isVisible = true;
            while (parent && parent !== document.body) {
              const style = window.getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                isVisible = false;
                break;
              }
              parent = parent.parentElement;
            }
            
            if (isVisible) {
              if (el.tagName.match(/^H[1-6]$/)) {
                textBlocks.push(`${el.tagName}: ${text}`);
              } else {
                textBlocks.push(text);
              }
            }
          }
        }
      });
      
      if (textBlocks.length > 0) {
        return {
          success: true,
          title: title,
          url: url,
          textContent: textBlocks.join('\n\n'),
          source: "Direct body extraction"
        };
      }
      
      return {
        success: false,
        reason: "no_content"
      };
    }
  } catch (error) {
    console.error("Error in direct extraction:", error);
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
}

// Super simple article extractor - no fancy algorithms, just grab the HTML and extract the text
function simpleArticleCapture() {
  console.log("Starting simple article capture");
  
  try {
    // Step 1: Grab the HTML of the webpage
    const title = document.title || "Captured Article";
    const url = window.location.href;
    
    // Check if we're in an iframe (if so, we can't reliably extract content)
    if (window !== window.top) {
      console.log("We're in an iframe - can't reliably extract content");
      return {
        success: false,
        reason: "iframe",
        message: "Content is in an iframe. Try capturing from the main page."
      };
    }
    
    // Step 2: Extract article content - ULTRA SIMPLIFIED APPROACH
    console.log("Using ultra-simplified approach to extract article text");
    let articleText = "";
    let articleSource = "";
    
    // STRATEGY: Directly collect all visible paragraphs with decent length
    const paragraphs = document.querySelectorAll('p');
    const paragraphTexts = [];
    
    // Process paragraphs
    paragraphs.forEach(p => {
      // Only include visible paragraphs with substantial content
      if (p.offsetWidth > 0 && p.offsetHeight > 0) {
        const text = p.textContent.trim();
        if (text && text.length > 20) {
          paragraphTexts.push(text);
        }
      }
    });
    
    // Also get important headings
    const headings = document.querySelectorAll('h1, h2, h3');
    const headingTexts = [];
    
    headings.forEach(h => {
      // Only include visible headings
      if (h.offsetWidth > 0 && h.offsetHeight > 0) {
        const text = h.textContent.trim();
        if (text) {
          headingTexts.push(`${h.tagName}: ${text}`);
        }
      }
    });
    
    // Combine headings and paragraphs
    if (headingTexts.length > 0 || paragraphTexts.length > 0) {
      articleText = [...headingTexts, ...paragraphTexts].join('\n\n');
      articleSource = "Direct paragraph extraction";
    }
    
    // Step 3: Return the extracted text
    if (articleText) {
      // Format the output
      const formattedResult = `Title: ${title}\nURL: ${url}\n\n${articleText}`;
      
      return {
        success: true,
        title: title,
        url: url,
        textContent: formattedResult,
        source: articleSource
      };
    }
    
    // No content found - could try an even simpler approach just getting all text
    console.log("No paragraphs found, trying raw text extraction");
    
    // Get all text nodes in the body with decent length
    const bodyText = document.body.innerText;
    if (bodyText && bodyText.length > 100) {
      // Split by newlines and filter out short lines
      const textLines = bodyText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 20);
      
      if (textLines.length > 0) {
        const formattedResult = `Title: ${title}\nURL: ${url}\n\n${textLines.join('\n\n')}`;
        
        return {
          success: true,
          title: title,
          url: url,
          textContent: formattedResult,
          source: "Raw text extraction"
        };
      }
    }
    
    // Still no content found
    return {
      success: false,
      reason: "no_content_found",
      message: "Could not extract article content from this page."
    };
    
  } catch (error) {
    console.error("Error in simple article capture:", error);
    return {
      success: false,
      reason: "error",
      error: error.message
    };
  }
}

// Main content capture function
function captureContent(port, formatType = "html", options = {}) {
  if (captureInProgress) {
    port.postMessage({
      status: "error",
      error: "Content capture already in progress"
    });
    return;
  }
  
  captureInProgress = true;
  const startTime = Date.now();
  const timingInfo = {};
  let performanceIssues = [];
  
  // Send initial progress update
  port.postMessage({
    status: "progress",
    progress: 10,
    message: "Starting content extraction"
  });
  
  try {
    console.log("Starting article content capture");
    
    // Check if we're in an iframe first
    if (window !== window.top) {
      // We're in an iframe - try to capture from main frame
      console.log("Detected we're in an iframe, attempting main frame capture via background script");
      chrome.runtime.sendMessage(
        { action: "captureMainFrameContent" },
        function(response) {
          console.log("Received response from background script for mainFrameContent:", response);
          if (response && response.status === "success" && response.data) {
            console.log("Main frame capture via background succeeded, sending success message");
            try {
              port.postMessage({
                status: "success",
                data: response.data.textContent, // Assuming background returns text content
                contentType: "plaintext",
                title: response.data.title,
                url: response.data.url,
                source: "Main frame capture (auto-switched from iframe)",
                stats: { isFrameInArticlePage: true, isCrossOrigin: true }, // Assume it might be cross-origin
                isTrackingPixel: false
              });
            } catch (portError) {
              console.error("Error sending success message to port:", portError);
            } finally {
              captureInProgress = false;
            }
          } else {
            const errorMsg = response?.error || "Main frame capture failed or returned no data";
            console.log(`Main frame capture via background failed: ${errorMsg}. Falling back to iframe content.`);
            // If main frame capture failed, try capturing the iframe content itself using Readability/fallbacks
            tryReadabilityOrFallbackCapture();
          }
        }
      );
      return; // Wait for the background script response
    }

    // Not in an iframe, proceed with capture directly
    tryReadabilityOrFallbackCapture();

    // Function to attempt Readability first, then fallbacks
    function tryReadabilityOrFallbackCapture() {
      port.postMessage({
        status: "progress",
        progress: 20,
        message: "Analyzing page structure..."
      });

      // **NEW: Prioritize Readability Algorithm**
      const readabilityResult = extractArticleWithReadability();

      if (readabilityResult && readabilityResult.element) {
        console.log(`Readability algorithm succeeded with score ${readabilityResult.score.toFixed(2)}. Extracting text.`);
        port.postMessage({ status: "progress", progress: 50, message: "Extracting content using Readability..." });

        // Extract plain text from the identified element
        const plainTextContent = extractPlainTextContent(readabilityResult.element, options);
        const title = readabilityResult.title || document.title || "Captured Page";
        const url = window.location.href;

        // Format the output
        const formattedResult = `Title: ${title}
URL: ${url}

${plainTextContent}`;

        port.postMessage({ status: "progress", progress: 90, message: "Content extracted successfully." });

        // Send the success message
        setTimeout(() => {
          try {
            console.log("Sending success message with Readability content");
            port.postMessage({
              status: "success",
              data: formattedResult,
              contentType: "plaintext",
              title: title,
              url: url,
              source: "Readability Algorithm",
              stats: { isFrameInArticlePage: window !== window.top, isCrossOrigin: false }, // Check if we are in a frame
              isTrackingPixel: false // Assume not tracking if Readability worked
            });
          } catch (successError) {
            console.error("Error sending success message (Readability):", successError);
          } finally {
            captureInProgress = false;
          }
        }, 100);

      } else {
        // **FALLBACK: Readability failed, use existing simple/direct methods**
        console.log("Readability algorithm failed or found no suitable content. Falling back to simple/direct extraction.");
        port.postMessage({ status: "progress", progress: 50, message: "Using fallback extraction method..." });
        trySimpleOrDirectCapture();
      }
    }


    // Function to try simple capture, then direct extraction as fallback
    function trySimpleOrDirectCapture() {
      try {
        console.log("Attempting simpleArticleCapture...");
        const result = simpleArticleCapture(); // Uses direct paragraph extraction
        console.log("simpleArticleCapture result:", result.success ? "success" : "failed", result.reason || '');

        if (result.success) {
          port.postMessage({ status: "progress", progress: 90, message: "Article content extracted (fallback)." });
          setTimeout(() => {
            try {
              console.log("Sending success message with simpleArticleCapture content");
              port.postMessage({
                status: "success",
                data: result.textContent, // Already formatted
                contentType: "plaintext",
                title: result.title,
                url: result.url,
                source: result.source,
                stats: { isFrameInArticlePage: window !== window.top, isCrossOrigin: false },
                isTrackingPixel: false
              });
            } catch (successError) {
              console.error("Error sending success message (Simple):", successError);
            } finally {
              captureInProgress = false;
            }
          }, 100);
        } else {
          // If simple capture failed, try direct extraction as final fallback
          console.log("simpleArticleCapture failed, trying directArticleContentExtraction as final fallback...");
          const directResult = directArticleContentExtraction(); // More aggressive extraction
          console.log("directArticleContentExtraction result:", directResult.success ? "success" : "failed", directResult.reason || '');

          if (directResult.success) {
            port.postMessage({ status: "progress", progress: 90, message: "Fallback extraction method succeeded." });

            // Format the content
            let formattedContent = `Title: ${directResult.title}
URL: ${directResult.url}

${directResult.textContent}

---
Extraction method: ${directResult.source}
Capture Date: ${new Date().toLocaleString()}`;

            setTimeout(() => {
              try {
                console.log("Sending success message with directArticleContentExtraction content");
                port.postMessage({
                  status: "success",
                  data: formattedContent,
                  contentType: "plaintext",
                  title: directResult.title,
                  url: directResult.url,
                  source: directResult.source,
                  stats: { isFrameInArticlePage: window !== window.top, isCrossOrigin: false },
                  isTrackingPixel: false
                });
              } catch (successError) {
                console.error("Error sending success message (Direct):", successError);
              } finally {
                captureInProgress = false;
              }
            }, 100);
          } else {
            // All extraction methods failed
            console.log("All extraction methods failed, sending error");
            port.postMessage({
              status: "error",
              error: `Failed to extract article content (${directResult.reason || result.reason || 'unknown error'}). Try Alternative Mode or check page structure.`
            });
            captureInProgress = false;
          }
        }
      } catch (fallbackError) {
        console.error("Error during fallback capture:", fallbackError);
        port.postMessage({
          status: "error",
          error: "Fallback capture failed: " + fallbackError.toString()
        });
        captureInProgress = false;
      }
    }
  } catch (error) {
    console.error("Error in main content capture function:", error);
    port.postMessage({
      status: "error",
      error: "Content capture failed: " + error.toString()
    });
    captureInProgress = false;
  }
}

// Listen for port connections
// **NEW: Wrap listener setup in try...catch**
try {
  chrome.runtime.onConnect.addListener(function(port) {
    // ** Log connection attempt immediately
    console.log(`[Content Script] ${window.location.href} - Port connection received. Port name: ${port.name}`);
    
    if (port.name === "pdf-capture") {
      console.log("Connected to port: pdf-capture");
      
      port.onMessage.addListener(function(message) {
        // ** Log received message
        console.log(`[Content Script] ${window.location.href} - Received port message:`, message);
        
        if (message.action === "fullCapture") {
          captureContent(port, message.formatType || "html", message.options || {});
        } else if (message.action === "textCapture") {
          // New action for text-only capture for API classification
          captureContent(port, "plaintext", message.options || {});
        } else if (message.action === "cancelCapture") {
          // Cancel any ongoing operation
          console.log("Received cancel request");
          captureInProgress = false;
          
          // Respond with cancellation confirmation
          try {
          port.postMessage({
            status: "cancelled",
            message: "Capture operation cancelled"
          });
            console.log("Sent cancellation confirmation");
          } catch (e) {
            console.error("Error sending cancellation confirmation:", e);
          }
        }
      });
      
      port.onDisconnect.addListener(function() {
        console.log(`[Content Script] ${window.location.href} - Port disconnected`);
        // Clean up if the popup is closed
        captureInProgress = false;
      });
    } else {
        console.warn(`[Content Script] ${window.location.href} - Unexpected port connection name: ${port.name}`);
    }
  });

  // Log after setting up the listener
  console.log(`[Content Script] ${window.location.href} - Connection listener setup complete.`);

} catch (error) {
  console.error(`[Content Script] ${window.location.href} - FATAL ERROR setting up connection listener:`, error);
}

// **Log to indicate the script reached the end of initial execution**
console.log(`[Content Script] ${window.location.href} - Script execution finished initial setup.`);

// Keep the legacy message listener for backward compatibility
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capturePDF" || request.action === "captureSimplifiedPDF") {
    console.log(`Received legacy ${request.action} request - use port connections instead`);
    sendResponse({ status: "Legacy API is deprecated, use port connections" });
    return true;
  }
});

// Helper function to generate a selector for an element (for debugging)
function getElementSelector(element) {
  if (!element) return 'unknown';
  if (element === document.body) return 'body';
  
  let selector = '';
  
  // Use ID if available
  if (element.id) {
    return '#' + element.id;
  }
  
  // Use classes if available
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    if (classes.length > 0) {
      selector = '.' + classes.join('.');
      // Check if this selector is unique
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }
  
  // Use tag name
  selector = element.tagName.toLowerCase();
  
  // Add position if needed
  if (element.parentNode) {
    const siblings = Array.from(element.parentNode.children);
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector += `:nth-child(${index})`;
    }
  }
  
  return selector;
}

// Function to detect if the page is likely a tracking pixel or image-only page
function detectTrackingPixelOrImage() {
  // Default result
  const result = {
    isTracking: false,
    type: 'regular webpage',
    reason: '',
    description: '',
    purpose: '',
    technicalDetails: ''
  };
  
  // Check if this is a legitimate article page
  function isLikelyArticlePage() {
    // Check for article indicators
    const hasArticleElement = document.querySelector('article') !== null;
    const hasHeadings = document.querySelectorAll('h1, h2, h3').length >= 2;
    const hasParagraphs = document.querySelectorAll('p').length >= 3;
    const hasSubstantialText = document.body.textContent.trim().length > 1000;
    const hasArticleMetadata = document.querySelector('time, [datetime], .author, .byline, .published') !== null;
    
    // Create a score for "article-ness"
    let articleScore = 0;
    if (hasArticleElement) articleScore += 20;
    if (hasHeadings) articleScore += 15;
    if (hasParagraphs) articleScore += 20;
    if (hasSubstantialText) articleScore += 25;
    if (hasArticleMetadata) articleScore += 20;
    
    // Consider it an article if score is high enough
    return articleScore > 30;
  }
  
  // If this is a top-level page that appears to be an article, never classify as tracking pixel
  if (window.top === window.self && isLikelyArticlePage()) {
    console.log("Detected likely article page based on content, skipping tracking pixel detection");
    return result;
  }
  
  // Check if we're in an iframe with article-like parent
  if (window !== window.top) {
    try {
      // Try to check if parent has article-like content
      const parentHasArticle = window.parent.document.querySelector('article') !== null;
      const parentHasSubstantialText = window.parent.document.body.textContent.trim().length > 1000;
      
      // If parent appears to be an article page and we're a small iframe
      if (parentHasArticle || parentHasSubstantialText) {
        // Check if our frame is small or has minimal content
        const ourContent = document.body.textContent.trim();
        if (ourContent.length < 500) {
          console.log("We're in an iframe on what appears to be an article page");
          
          // Instead of marking as tracking pixel, indicate we need to capture the parent frame
          result.isTracking = true;
          result.type = 'embedded content frame';
          result.reason = 'This is an embedded frame within what appears to be an article page';
          result.description = 'To get the actual article content, please capture the main page instead of this frame.';
          return result;
        }
      }
    } catch (e) {
      // Cross-origin access error, continue with normal detection
      console.log("Cross-origin iframe detection:", e);
    }
  }
  
  // Check page content and structure for tracking pixel indicators
  
  // Check URL patterns common for tracking pixels
  const url = window.location.href.toLowerCase();
  const trackingUrlPatterns = [
    { pattern: /pixel/, name: 'pixel tracker' },
    { pattern: /beacon/, name: 'web beacon' },
    { pattern: /track/, name: 'tracking endpoint' },
    { pattern: /collect/, name: 'data collection endpoint' },
    { pattern: /analytics/, name: 'analytics tracker' },
    { pattern: /telemetry/, name: 'telemetry endpoint' },
    { pattern: /1x1\.gif|1x1\.png|1x1\.jpg/, name: 'invisible tracking image' }
  ];
  
  // Check if the URL contains tracking patterns
  for (const pattern of trackingUrlPatterns) {
    if (pattern.pattern.test(url)) {
      result.isTracking = true;
      result.type = pattern.name;
      result.reason = `URL contains pattern suggesting a ${pattern.name}`;
      break;
    }
  }
  
  // Check page content and structure
  const bodyText = document.body.innerText.trim();
  const visibleElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, span');
  
  // If page has almost no text and very few visible elements
  if (!result.isTracking && bodyText.length < 100 && visibleElements.length < 5) {
    // Check if page contains a single image
    const images = document.querySelectorAll('img');
    if (images.length === 1 && document.body.childElementCount < 5) {
      result.isTracking = true;
      result.type = 'single image page or transparent tracking image';
      result.reason = 'Page consists of a single image with minimal other content';
    }
    // Or if it's just an empty/minimal page
    else if (bodyText.length < 20) {
      result.isTracking = true;
      result.type = 'tracking endpoint or beacon';
      result.reason = 'Page contains almost no visible text content';
    }
  }
  
  // Add details if this is a tracking element
  if (result.isTracking) {
    result.description = 'This appears to be a tracking or analytics endpoint rather than a page with readable content.';
    result.purpose = 'collecting user data, session information, or confirming that a user has viewed content elsewhere';
    
    // Include technical details
    const metaTags = Array.from(document.querySelectorAll('meta')).map(tag => 
      `${tag.getAttribute('name') || tag.getAttribute('property') || 'unnamed'}: ${tag.getAttribute('content') || 'no content'}`
    ).join('\n');
    
    result.technicalDetails = `
Page size: ${document.documentElement.outerHTML.length} bytes
Text content: ${bodyText.length} characters
Images: ${document.querySelectorAll('img').length}
Scripts: ${document.querySelectorAll('script').length}
Meta tags: ${document.querySelectorAll('meta').length}

${metaTags ? 'Meta tag information:\n' + metaTags : 'No meta tags found'}
    `.trim();
  }
  
  return result;
}