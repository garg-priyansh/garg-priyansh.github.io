let allPublications = [];
let showingSelected = true;

document.addEventListener('DOMContentLoaded', function() {
  loadPublications();
  
  const sections = document.querySelectorAll('section');
  sections.forEach((section, index) => {
    section.style.animationDelay = `${index * 0.1}s`;
  });
});

function loadPublications() {
  fetch('publications.json')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(data => {
      allPublications = data.publications || [];
      renderPublications();
    })
    .catch(error => {
      console.error('Error loading publications:', error);
      const pubSection = document.getElementById('publications');
      if (pubSection) pubSection.style.display = 'none';
    });
}

function renderPublications() {
  const pubSection = document.getElementById('publications');
  if (!pubSection) return;

  // Skip section and header completely if no publications exist
  if (!allPublications || allPublications.length === 0) {
    pubSection.style.display = 'none';
    return;
  }

  pubSection.style.display = 'block';

  const pubsToShow = showingSelected ? 
    allPublications.filter(pub => pub.selected === 1) : 
    allPublications;

  const listToRender = (showingSelected && pubsToShow.length === 0) ? allPublications : pubsToShow;

  pubSection.innerHTML = `
    <div class="publications-header">
        <h2 id="toggle-header">${showingSelected ? 'Selected Publications' : 'All Publications'}</h2>
        ${allPublications.length > 1 ? `<button id="toggle-publications" class="toggle-publications">${showingSelected ? 'Show All' : 'Show Selected'}</button>` : ''}
    </div>
    <div id="publications-container"></div>
  `;

  const container = document.getElementById('publications-container');
  listToRender.forEach(pub => {
    container.appendChild(createPublicationElement(pub));
  });

  const toggleBtn = document.getElementById('toggle-publications');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      showingSelected = !showingSelected;
      renderPublications();
    });
  }
}

function createPublicationElement(publication) {
  const pubItem = document.createElement('div');
  pubItem.className = 'publication-item';
  
  let thumbnailHTML = '';
  if (publication.thumbnail) {
    thumbnailHTML = `
      <div class="pub-thumbnail" onclick="openModal('${publication.thumbnail}')">
        <img src="${publication.thumbnail}" alt="${publication.title} thumbnail">
      </div>
    `;
  }
  
  let authorsHTML = '';
  if (publication.authors) {
    authorsHTML = publication.authors.map(author => 
      author.includes('Priyansh Garg') ? `<span class="highlight-name">${author}</span>` : author
    ).join(', ');
  }

  let pdfLinkHTML = '';
  if (publication.links && publication.links.pdf) {
    pdfLinkHTML = `<div class="pub-links"><a href="${publication.links.pdf}" target="_blank">[PDF]</a></div>`;
  }

  pubItem.innerHTML = `
    ${thumbnailHTML}
    <div class="pub-content">
      <div class="pub-title">${publication.title}</div>
      <div class="pub-authors">${authorsHTML}</div>
      <div class="pub-venue-container">
        <div class="pub-venue">${publication.venue || ''}</div>
      </div>
      ${pdfLinkHTML}
    </div>
  `;
  
  return pubItem;
}

function openModal(imageSrc) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  if (modal && modalImg) {
    modal.style.display = "block";
    modalImg.src = imageSrc;
  }
}

function closeModal() {
  const modal = document.getElementById('imageModal');
  if (modal) modal.style.display = "none";
}

window.onclick = function(event) {
  const modal = document.getElementById('imageModal');
  if (event.target == modal) {
    closeModal();
  }
};