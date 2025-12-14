E-GMP Bluelink Scriptable
C’est quoi ça?

C’est une autre app Bluelink pour contrôler ta Hyundai/Kia électrique E-GMP, mais en version Scriptable pour iOS. Ça te permet de piloter ton char avec l’API Bluelink, pis ça fait pas planter ton téléphone.

Features (les affaires cool)

Widgets Home Screen et Lock Screen qui se mettent à jour tout seuls

UI plus fraîche et réactive que l’app normale

Un clic pour locker, chauffer, charger ton char, pis ça marche même dans le Control Center iOS

Siri supporté : « Hey Siri, chauffe le char »

Automatisations via Shortcuts iOS, genre verrouillage automatique quand tu t’éloignes

Climatisation custom illimitée, parce qu’on est fancy

Docs

Tout ce que t’as besoin de savoir, comment installer pis utiliser l’app est ici :
https://bluelink.andyfase.com

En action

<img src="./docs/images/widget_charging.png" width="400px"/>

<center>(Clique pour voir la vidéo)</center>
Pour les devs (ou les curieux)
Structure du repo / Code

Le code est en TypeScript, transpillé en JavaScript parce que Scriptable aime ça comme ça.

/src — code principal de l’app

/docs — site Jekyll pour la doc (GitHub Pages friendly)

/.github/docs.yml — pipeline GitHub Actions pour build et deploy la doc

/exampleData — exemples de payloads API

Pour build le code

cd src
npm install
npm run build ./src/index.ts egmp-bluelink