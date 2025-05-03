// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendMessage');
const loadPresentationBtn = document.getElementById('loadPresentation');
const newPresentationBtn = document.getElementById('newPresentation');
const addSlideBtn = document.getElementById('addSlide');
const savePresentationBtn = document.getElementById('savePresentation');
const fileInput = document.getElementById('fileInput');
const presentationPreview = document.getElementById('presentation-preview');

// State
let currentPresentation = null;
let presentationState = {
    slides: [],
    currentSlideIndex: -1,
    awaitingInput: {
        type: null, // 'title', 'content', 'content_choice'
        slideIndex: null
    }
};

// Event Listeners
sendButton.addEventListener('click', handleSendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

loadPresentationBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', handleFileUpload);
newPresentationBtn.addEventListener('click', handleNewPresentation);
addSlideBtn.addEventListener('click', handleAddSlide);
savePresentationBtn.addEventListener('click', handleSavePresentation);

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
});

// On page load, show Main Functions in the right drawer
window.addEventListener('DOMContentLoaded', () => {
    openDrawerForMenu('Style');
    // Main bar button triggers
    const newPresMain = document.getElementById('newPresentationMain');
    const loadPresMain = document.getElementById('loadPresentationMain');
    if (newPresMain) newPresMain.onclick = () => document.getElementById('newPresentation').click();
    if (loadPresMain) loadPresMain.onclick = () => document.getElementById('loadPresentation').click();
});

document.querySelectorAll('.sidebar-menu-item').forEach(item => {
    item.addEventListener('click', function() {
        // Remove active class from all
        document.querySelectorAll('.sidebar-menu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const text = this.textContent.trim();
        openDrawerForMenu(text);
    });
});

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(ppt|pptx)$/i)) {
        addMessage('Please select a valid PowerPoint file (.ppt or .pptx)', 'system');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:5001/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const data = await response.json();
        currentPresentation = {
            name: file.name,
            size: formatFileSize(file.size),
            lastModified: new Date(file.lastModified).toLocaleString()
        };

        // Fetch slides from the uploaded presentation
        const slidesResponse = await fetch('http://localhost:5001/api/get-slides', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename: file.name })
        });
        let slides = [];
        if (slidesResponse.ok) {
            const slidesData = await slidesResponse.json();
            slides = slidesData.slides || [];
        }

        presentationState = {
            slides: slides,
            currentSlideIndex: slides.length > 0 ? 0 : -1,
            awaitingInput: {
                type: null,
                slideIndex: null
            }
        };

        updatePresentationPreview();
        addMessage(`Successfully loaded presentation: ${file.name}`, 'system');
    } catch (error) {
        console.error('Error uploading file:', error);
        addMessage('Error uploading presentation. Please try again.', 'system');
    }
}

// Handle new presentation
function handleNewPresentation() {
    currentPresentation = {
        name: 'New Presentation',
        size: '0 KB',
        lastModified: new Date().toLocaleString()
    };

    presentationState = {
        slides: [],
        currentSlideIndex: -1,
        awaitingInput: {
            type: null,
            slideIndex: null
        }
    };

    updatePresentationPreview();
    addMessage('Created new presentation', 'system');
}

// Show slide layout modal and handle selection
function showSlideLayoutModal(onSelect) {
    const modal = document.getElementById('slideLayoutModal');
    modal.style.display = 'flex';
    const cards = modal.querySelectorAll('.layout-card');
    cards.forEach(card => card.classList.remove('selected'));
    cards.forEach(card => {
        card.onclick = () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        };
    });
    const buttons = modal.querySelectorAll('.select-layout-btn');
    buttons.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const card = btn.closest('.layout-card');
            const layout = card.getAttribute('data-layout');
            modal.style.display = 'none';
            onSelect(layout);
        };
    });
}

// Modified handleAddSlide to use layout modal
function handleAddSlide() {
    if (!currentPresentation) {
        addMessage('Please create or load a presentation first', 'system');
        return;
    }
    showSlideLayoutModal((selectedLayout) => {
        const newSlide = {
            title: '',
            content: '',
            layoutType: selectedLayout,
            index: presentationState.slides.length
        };
        presentationState.slides.push(newSlide);
        presentationState.currentSlideIndex = newSlide.index;
        presentationState.awaitingInput = {
            type: 'content_choice',
            slideIndex: newSlide.index
        };
        updatePresentationPreview();
        addMessage("How would you like to create the slide content?", 'system');
        addMessage("1. Type 'AI' to generate content using AI\n2. Type 'MANUAL' to write your own content", 'system');
    });
}

// Handle save presentation
async function handleSavePresentation() {
    if (!currentPresentation || presentationState.slides.length === 0) {
        addMessage('No presentation to save', 'system');
        return;
    }

    try {
        const response = await fetch('http://localhost:5001/api/save-presentation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                slides: presentationState.slides,
                filename: currentPresentation.name,
                styleColors: JSON.parse(localStorage.getItem('styleColors') || '{}'),
                logoSettings: JSON.parse(localStorage.getItem('logoSettings') || '{}')
            })
        });

        if (!response.ok) {
            throw new Error('Save failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'presentation_edited.pptx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        addMessage('Presentation saved successfully!', 'system');
    } catch (error) {
        console.error('Error saving presentation:', error);
        addMessage('Error saving presentation. Please try again.', 'system');
    }
}

// Handle sending messages
function handleSendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    messageInput.value = '';
    messageInput.style.height = 'auto';

    processMessage(message);
}

// Process the user's message
async function processMessage(message) {
    if (presentationState.awaitingInput.type) {
        await handleSlideInput(message);
        return;
    }
}

// Handle slide input
async function handleSlideInput(message) {
    const { type, slideIndex } = presentationState.awaitingInput;
    const slide = presentationState.slides[slideIndex];

    if (type === 'content_choice') {
        if (message.toUpperCase() === 'AI') {
            addMessage("Please enter a topic or title for the AI to generate content:", 'system');
            presentationState.awaitingInput.type = 'ai_title';
        } else if (message.toUpperCase() === 'MANUAL') {
            addMessage("Please enter the title for the slide:", 'system');
            presentationState.awaitingInput.type = 'title';
        } else {
            addMessage("Please type either 'AI' or 'MANUAL' to proceed.", 'system');
        }
    } else if (type === 'ai_title') {
        try {
            const response = await fetch('http://localhost:5001/api/generate-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: message })
            });

            if (!response.ok) {
                throw new Error('Content generation failed');
            }

            const data = await response.json();
            slide.title = message;
            slide.content = formatContentToBulletPoints(data.content);
            
            presentationState.awaitingInput = {
                type: null,
                slideIndex: null
            };
            
            updatePresentationPreview();
            addMessage("Slide has been created with AI-generated content!", 'system');
        } catch (error) {
            console.error('Error generating content:', error);
            addMessage("Error generating content. Please try manual input by typing 'MANUAL'.", 'system');
            presentationState.awaitingInput.type = 'content_choice';
        }
    } else if (type === 'title') {
        slide.title = message;
        addMessage("Please enter the content for the slide (use * for bullet points):", 'system');
        addMessage("Example:\n* Point 1: Description for point 1\n* Point 2: Description for point 2\n* Point 3: Description for point 3", 'system');
        presentationState.awaitingInput.type = 'content';
    } else if (type === 'content') {
        slide.content = formatContentToBulletPoints(message);
        presentationState.awaitingInput = {
            type: null,
            slideIndex: null
        };
        updatePresentationPreview();
        addMessage("Slide has been created successfully!", 'system');
    }
}

// Helper function to format content into bullet points
function formatContentToBulletPoints(content) {
    // Split content into lines
    const lines = content.split('\n');
    
    // Process each line
    const bulletPoints = lines.map(line => {
        // Remove any existing bullet points or numbers
        line = line.replace(/^[\d\.\-\*]+/, '').trim();
        
        // Skip empty lines
        if (!line) return '';
        
        // Split the line into title and content if it contains a colon
        const [title, ...contentParts] = line.split(':');
        const content = contentParts.join(':').trim();
        
        return {
            title: title.trim(),
            content: content || title.trim() // If no content after colon, use the whole line as content
        };
    }).filter(item => item.title !== ''); // Remove empty lines
    
    return bulletPoints;
}

// Update presentation preview
function updatePresentationPreview() {
    if (!currentPresentation) return;

    let previewHTML = `
        <div class="presentation-info">
            <i class="fas fa-file-powerpoint"></i>
            <h4>${currentPresentation.name}</h4>
            <p>Size: ${currentPresentation.size}</p>
            <p>Last Modified: ${currentPresentation.lastModified}</p>
            <div class="slides-preview">
                <h5>Slides (${presentationState.slides.length})</h5>
                <div class="slides-list">
    `;

    presentationState.slides.forEach((slide, index) => {
        previewHTML += `
            <div class="slide-item ${index === presentationState.currentSlideIndex ? 'active' : ''}">
                <span class="slide-number">${index + 1}</span>
                <span class="slide-title">${slide.title || 'Untitled'}</span>
            </div>
        `;
    });

    previewHTML += `
                </div>
            </div>
        </div>
    `;

    presentationPreview.innerHTML = previewHTML;
}

// Add a message to the chat
function addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = content;
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Always scroll to the bottom to show the latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function openDrawerForMenu(menu) {
    const drawer = document.getElementById('rightDrawer');
    const content = document.getElementById('drawerContent');
    let html = '';
    if (menu === 'Main Functions') {
        html = `
            <h3>Main Functions</h3>
            <div class="drawer-btn-group">
                <button class="drawer-btn" id="drawerNewPresentationBtn"><i class="fas fa-plus"></i> Create new presentation</button>
                <button class="drawer-btn" id="drawerUploadBtn"><i class="fas fa-upload"></i> Upload presentation</button>
                <button class="drawer-btn" id="drawerAddSlideBtn"><i class="fas fa-plus"></i> Add new Slide</button>
                <button class="drawer-btn" id="drawerSaveBtn"><i class="fas fa-save"></i> Save Presentation</button>
            </div>
        `;
    } else if (menu === 'Style') {
        html = `
            <h3>Style</h3>
            <div class="drawer-style-group">
                <h4>Theme</h4>
                <div class="drawer-style-item">
                    <label>Content Text Color</label>
                    <div class="drawer-color-row">
                        <input type="color" id="contentTextColorPicker" class="drawer-color-picker">
                        <input type="text" id="contentTextColorRGB" class="drawer-input" placeholder="RGB Code (e.g. 34,34,34)">
                    </div>
                </div>
                <div class="drawer-style-item">
                    <label>Highlight or Specials</label>
                    <div class="drawer-color-row">
                        <input type="color" id="highlightColorPicker" class="drawer-color-picker">
                        <input type="text" id="highlightColorRGB" class="drawer-input" placeholder="RGB Code (e.g. 220,53,69)">
                    </div>
                </div>
                <div class="drawer-style-item">
                    <label>Forms background</label>
                    <div class="drawer-color-row">
                        <input type="color" id="formsBgColorPicker" class="drawer-color-picker">
                        <input type="text" id="formsBgColorRGB" class="drawer-input" placeholder="RGB Code (e.g. 244,246,251)">
                    </div>
                </div>
                <button class="drawer-btn" id="saveStyleColorsBtn"><i class="fas fa-save"></i> Save Colors</button>
                <hr style="margin: 18px 0;">
                <h4>Logo</h4>
                <div class="drawer-style-item">
                    <label>Upload Logo</label>
                    <input type="file" id="logoUploadInput" accept="image/*">
                </div>
                <div class="drawer-style-item">
                    <label>Logo Position</label>
                    <select id="logoPositionSelect" class="drawer-input">
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                    </select>
                </div>
                <button class="drawer-btn" id="saveLogoBtn"><i class="fas fa-save"></i> Save Logo</button>
                <div id="logoPreview" style="margin-top:10px;"></div>
            </div>
        `;
    } else if (menu === 'Prompt specifics') {
        html = `
            <h3>Prompt specifics</h3>
            <textarea class="drawer-input" placeholder="Write your prompt here..."></textarea>
        `;
    } else if (menu === 'Content Management') {
        html = `
            <h3>Content Management</h3>
            <div class="drawer-btn-group">
                <button class="drawer-btn">Manual</button>
                <button class="drawer-btn">AI generates your content</button>
                <button class="drawer-btn">AI summarizes your content</button>
            </div>
        `;
    }
    content.innerHTML = html;
    drawer.style.display = 'flex';

    // Attach event listeners for drawer buttons
    if (menu === 'Main Functions') {
        document.getElementById('drawerNewPresentationBtn').onclick = () => document.getElementById('newPresentation').click();
        document.getElementById('drawerUploadBtn').onclick = () => document.getElementById('loadPresentation').click();
        document.getElementById('drawerAddSlideBtn').onclick = () => document.getElementById('addSlide').click();
        document.getElementById('drawerSaveBtn').onclick = () => document.getElementById('savePresentation').click();
    }

    // Style drawer: populate pickers and save
    if (menu === 'Style') {
        // Load saved colors if available
        const saved = JSON.parse(localStorage.getItem('styleColors') || '{}');
        if (saved.contentTextColor) document.getElementById('contentTextColorPicker').value = saved.contentTextColor;
        if (saved.contentTextColorRGB) document.getElementById('contentTextColorRGB').value = saved.contentTextColorRGB;
        if (saved.highlightColor) document.getElementById('highlightColorPicker').value = saved.highlightColor;
        if (saved.highlightColorRGB) document.getElementById('highlightColorRGB').value = saved.highlightColorRGB;
        if (saved.formsBgColor) document.getElementById('formsBgColorPicker').value = saved.formsBgColor;
        if (saved.formsBgColorRGB) document.getElementById('formsBgColorRGB').value = saved.formsBgColorRGB;

        // Sync color pickers and RGB fields
        document.getElementById('contentTextColorPicker').addEventListener('input', e => {
            document.getElementById('contentTextColorRGB').value = hexToRgbString(e.target.value);
        });
        document.getElementById('highlightColorPicker').addEventListener('input', e => {
            document.getElementById('highlightColorRGB').value = hexToRgbString(e.target.value);
        });
        document.getElementById('formsBgColorPicker').addEventListener('input', e => {
            document.getElementById('formsBgColorRGB').value = hexToRgbString(e.target.value);
        });
        document.getElementById('saveStyleColorsBtn').onclick = () => {
            const styleColors = {
                contentTextColor: document.getElementById('contentTextColorPicker').value,
                contentTextColorRGB: document.getElementById('contentTextColorRGB').value,
                highlightColor: document.getElementById('highlightColorPicker').value,
                highlightColorRGB: document.getElementById('highlightColorRGB').value,
                formsBgColor: document.getElementById('formsBgColorPicker').value,
                formsBgColorRGB: document.getElementById('formsBgColorRGB').value
            };
            localStorage.setItem('styleColors', JSON.stringify(styleColors));
            alert('Colors saved!');
        };

        // Logo section
        const savedLogo = JSON.parse(localStorage.getItem('logoSettings') || '{}');
        if (savedLogo.logoPosition) document.getElementById('logoPositionSelect').value = savedLogo.logoPosition;
        if (savedLogo.logoDataUrl) {
            document.getElementById('logoPreview').innerHTML = `<img src="${savedLogo.logoDataUrl}" style="max-width:100px;max-height:100px;">`;
        }
        document.getElementById('logoUploadInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                document.getElementById('logoPreview').innerHTML = `<img src="${evt.target.result}" style="max-width:100px;max-height:100px;">`;
                // Save temporarily in localStorage for preview
                const logoSettings = JSON.parse(localStorage.getItem('logoSettings') || '{}');
                logoSettings.logoDataUrl = evt.target.result;
                localStorage.setItem('logoSettings', JSON.stringify(logoSettings));
            };
            reader.readAsDataURL(file);
        });
        document.getElementById('saveLogoBtn').onclick = () => {
            const logoPosition = document.getElementById('logoPositionSelect').value;
            const logoImg = document.getElementById('logoPreview').querySelector('img');
            const logoDataUrl = logoImg ? logoImg.src : '';
            const logoSettings = {
                logoDataUrl,
                logoPosition
            };
            localStorage.setItem('logoSettings', JSON.stringify(logoSettings));
            alert('Logo settings saved!');
        };
    }
}

function hexToRgbString(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `${r},${g},${b}`;
} 