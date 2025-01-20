// ==UserScript==
// @name        FB Video Saver
// @match       https://www.facebook.com/*
// @grant       GM_registerMenuCommand
// @version     1.0
// @author      Macxzew
// @description Un script pour Facebook permettant de télécharger des vidéos ou des collections de vidéos.
// @license     MIT
// ==/UserScript==

(async () => {
    'use strict';
  
    const processedLinks = new Set();
    const processedVideos = new Set();
    let videoDetails = null;
  
    const addUIButton = () => {
      setTimeout(() => {
        const button = document.createElement('button');
        button.textContent = 'Télécharger';
        Object.assign(button.style, {
          position: 'fixed',
          top: '1%',
          right: '20%',
          backgroundColor: '#007bff',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          zIndex: '9999',
        });
  
        button.addEventListener('click', () => {
          const url = window.location.href;
          if (url.includes('/saved/')) {
            processSavedVideos();
          } else if (url.includes('/reel/') || url.includes('/videos/') || url.includes('/watch/')) {
            downloadVisibleVideo();
          } else {
            alert('Aucune action disponible pour cette page.');
          }
        });
  
        document.body.appendChild(button);
      }, 2500);
    };
  
    const createNotification = (message) => {
      const notification = document.createElement('div');
      notification.textContent = message;
      Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: 'rgba(0, 128, 0, 0.9)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '5px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        fontSize: '14px',
        zIndex: '9999',
        animation: 'fadeout 3s forwards',
      });
  
      document.body.appendChild(notification);
  
      setTimeout(() => {
        notification.remove();
      }, 3000);
  
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeout {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    };
  
    const collectVideoDetails = async () => {
      const url = window.location.href;
      if (!url.includes('/reel/') && !url.includes('/videos/') && !url.includes('/watch/')) {
        console.log('Cette page ne contient pas de contenu vidéo pertinent.');
        return;
      }
  
      videoDetails = null;
      const video = document.querySelector('video');
      if (!video) return console.error('Aucune vidéo visible n\'a été trouvée.');
  
      const reactPropsKey = Object.keys(video.parentElement).find(key => key.startsWith('__reactProps'));
      const videoFBID = video.parentElement[reactPropsKey]?.children?.props?.videoFBID;
  
      if (!videoFBID) return console.error('Impossible de récupérer l\'identifiant de la vidéo.');
  
      const requestBody = new URLSearchParams({
        doc_id: '5279476072161634',
        variables: JSON.stringify({ videoID: videoFBID }),
        fb_dtsg: require('DTSGInitialData').token,
      });
  
      const response = await fetch('https://www.facebook.com/api/graphql/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: requestBody.toString(),
      });
  
      const data = JSON.parse((await response.text()).split('\n')[0])?.data?.video;
      const videoURL = data?.playable_url_quality_hd || data?.playable_url;
  
      if (!videoURL) return console.error('Impossible de récupérer l\'URL de la vidéo.');
  
      videoDetails = { url: videoURL, ready: true };
    };
  
    const downloadVisibleVideo = async () => {
      if (!videoDetails || !videoDetails.ready) return false;
  
      const blob = await (await fetch(videoDetails.url)).blob();
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = 'video.mp4';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      createNotification('La vidéo a été téléchargée avec succès.');
      return true;
    };
  
      const processSavedVideos = async () => {
          const url = window.location.href;
          if (!url.includes('/saved/')) return;
  
          let skipNext = false;
  
          const getVideoLinks = () => {
              return Array.from(document.querySelectorAll('a'))
                  .map(a => a.href)
                  .filter(href => (href.includes('/watch/') || href.includes('/reel/') || href.includes('/videos/')))
                  .filter(href => !processedLinks.has(href)); // Filtrer les liens déjà traités
          };
  
          const refreshPageContent = async () => {
              let lastHeight = 0;
              while (true) {
                  window.scrollTo(0, document.body.scrollHeight);
                  await new Promise(resolve => setTimeout(resolve, 500));
                  const newHeight = document.body.scrollHeight;
                  if (newHeight === lastHeight) break;
                  lastHeight = newHeight;
              }
          };
  
          await refreshPageContent(); // Charger tous les liens visibles au départ
          let links = getVideoLinks();
  
          for (const link of links) {
              if (processedLinks.has(link)) continue; // Éviter les doublons
  
              if (skipNext) {
                  console.log(`Lien sauté : ${link}`);
                  skipNext = false; // Réinitialiser après avoir sauté un lien
                  continue;
              }
  
              const newTab = window.open(link, '_blank');
              if (!newTab) continue;
  
              try {
                  await new Promise(resolve => {
                      const interval = setInterval(() => {
                          if (newTab.document.readyState === 'complete') {
                              clearInterval(interval);
                              resolve();
                          }
                      }, 500);
                  });
  
                  if (processedLinks.has(link)) {
                      console.log(`Lien déjà téléchargé : ${link}`);
                      newTab.close();
                      continue;
                  }
  
                  const success = await downloadVideoFromDocument(newTab.document);
                  if (success) {
                      processedLinks.add(link); // Ajouter à la liste des liens traités
  
                      // Vérifier le type de lien pour décider de sauter ou non
                      if (link.includes('/reel/') || link.includes('/watch/')) {
                          console.log(`Lien de type "reel" ou "watch" détecté, saut du prochain lien.`);
                          skipNext = true;
                      }
                  }
  
                  newTab.close();
              } catch (error) {
                  console.error(`Erreur lors du traitement du lien : ${link}`, error);
                  newTab.close();
              }
  
              // Réactualiser la liste des liens après chaque téléchargement
              console.log('Réactualisation des liens visibles...');
              await refreshPageContent();
              links = getVideoLinks();
          }
  
          // Effacer les liens traités de la liste
          processedLinks.clear();
          console.log('Liste des liens traités effacée.');
  
          // Actualiser la page principale "saved"
          console.log('Actualisation de la page principale...');
          window.location.reload();
      };
  
  
  
    const downloadVideoFromDocument = async (doc) => {
      const video = doc.querySelector('video');
      if (!video) return console.error('Aucune vidéo visible n\'a été trouvée.'), false;
  
      const reactPropsKey = Object.keys(video.parentElement).find(key => key.startsWith('__reactProps'));
      const videoFBID = video.parentElement[reactPropsKey]?.children?.props?.videoFBID;
  
      if (!videoFBID) return console.error('Impossible de récupérer l\'identifiant de la vidéo.'), false;
  
      const requestBody = new URLSearchParams({
        doc_id: '5279476072161634',
        variables: JSON.stringify({ videoID: videoFBID }),
        fb_dtsg: require('DTSGInitialData').token,
      });
  
      const response = await fetch('https://www.facebook.com/api/graphql/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: requestBody.toString(),
      });
  
      const data = JSON.parse((await response.text()).split('\n')[0])?.data?.video;
      const videoURL = data?.playable_url_quality_hd || data?.playable_url;
  
      if (!videoURL || processedVideos.has(videoURL)) return console.error('Impossible de récupérer l\'URL de la vidéo.'), false;
  
      processedVideos.add(videoURL);
  
      const blob = await (await fetch(videoURL)).blob();
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = 'video.mp4';
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    };
  
    window.addEventListener('load', () => {
      collectVideoDetails();
      addUIButton();
    });
  
    window.addEventListener('popstate', collectVideoDetails);
  
    ((history) => {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
  
      history.pushState = function (...args) {
        const result = originalPushState.apply(this, args);
        window.dispatchEvent(new Event('pushstate'));
        return result;
      };
  
      history.replaceState = function (...args) {
        const result = originalReplaceState.apply(this, args);
        window.dispatchEvent(new Event('replacestate'));
        return result;
      };
    })(window.history);
  
    const previousUrl = { value: window.location.href };
  
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl.includes('/saved/') && !previousUrl.value.includes('/saved/')) {
        console.log('L\'URL a changé vers "saved". Actualisation de la page...');
        window.location.reload();
      }
      previousUrl.value = currentUrl;
    };
  
    window.addEventListener('pushstate', () => {
      collectVideoDetails();
      checkUrlChange();
    });
  
    window.addEventListener('replacestate', () => {
      collectVideoDetails();
      checkUrlChange();
    });
  
    window.addEventListener('popstate', () => {
      collectVideoDetails();
      checkUrlChange();
    });
  
    setInterval(checkUrlChange, 500); // Vérifier les changements d'URL régulièrement
  
    GM_registerMenuCommand('Download Video', () => {
      const url = window.location.href;
      if (!url.includes('/saved/') && !url.includes('/videos/') && !url.includes('/watch/')) {
        alert('Aucune action disponible pour cette page.');
      } else {
        downloadVisibleVideo();
      }
    });
  
    GM_registerMenuCommand('Process Saved Videos', processSavedVideos);
  })();
  
  