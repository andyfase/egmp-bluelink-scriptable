---
title: Aide
layout: home
nav_order: 8
---

# Aide / FAQ
{: .fs-9 }

Ci-dessous se trouve une liste des questions et problèmes courants ainsi que leurs résolutions.
{: .fs-5 .fw-300 }

### Est-ce une vraie application, et sinon pourquoi ?

Non, ce n’est pas une application disponible sur l’Apple App Store. Il s’agit d’une "app" ou script pour [Scriptable](https://scriptable.app/). Vous devez donc installer l’application Scriptable depuis l’App Store, puis installer le fichier JavaScript de Bluelink-Scriptable. Tout cela est documenté sur la page [Installation](./install.md).
{: .fs-4 .fw-400 }

Pourquoi ? C’est plus simple à développer ainsi, et cela permet de ne pas être limité par les règles de l’App Store concernant ce qui est autorisé. Cette application utilise des API Hyundai et Kia non documentées, et il est probable qu’une app iOS officielle serait rejetée ou retirée de l’App Store — ce qui n’est pas le cas via Scriptable.
{: .fs-4 .fw-400 }

### Le support Android est-il prévu ?

Non, cette application est uniquement iOS et je n’ai ni la possibilité ni l’envie de produire une version Android. [Scriptable](https://scriptable.app/) n’existe que sur iOS. L’équivalent Android le plus proche serait Tasker, mais il ne permet pas de créer de manière simple des écrans et widgets personnalisés.

Pour qu’une version fonctionne sur Android, quelqu’un devrait développer une [application React Native](https://reactnative.dev/) qui pourrait ensuite être installée manuellement. Évidemment, ce code est open source et disponible pour toute personne souhaitant relever ce défi. :-)

### Ai-je besoin d’un abonnement Kia / Hyundai Bluelink pour utiliser ceci ?

Oui, ou probablement oui. Cette application utilise les mêmes API Hyundai et Kia que les applications officielles App Store. Aucun contrôle n’est effectué dans le code pour vérifier l’accès à Bluelink, mais on suppose que les API ne fonctionneront pas sans un abonnement valide.

### Mes identifiants Bluelink sont-ils sécurisés ?

Oui. Toute la configuration (nom d’utilisateur, mot de passe et code PIN Bluelink) est stockée localement dans le trousseau iOS. Ces informations ne sont exposées que si vous activez le mode Debug Logging, auquel cas elles pourraient être enregistrées dans les fichiers de logs — lesquels restent accessibles uniquement dans votre propre répertoire iCloud.

### Quels pays / constructeurs sont supportés ?

Voir la page [Régions](./region.md) pour les régions supportées.

### Les voitures à moteur thermique (ICE) sont-elles supportées ?

Pas encore. Cette application a été écrite spécifiquement pour les véhicules électriques Hyundai et Kia E-GMP. J’ai été sollicité pour ajouter le support des véhicules ICE, ce que je pourrais envisager. Si vous souhaitez cette fonctionnalité, faites-le savoir en ajoutant ou commentant un [issue GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/issues).

### J’ai saisi mes identifiants incorrectement et l’app ne s’ouvre pas / ne fait rien

Vous devrez réinitialiser la configuration stockée. Je fournis un script "reset" dans toutes les [releases GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/releases). Téléchargez le fichier `egmp-reset.js` dans votre répertoire Scriptable et exécutez-le. Lorsque demandé, réinitialisez votre configuration principale.

### Je pense avoir trouvé un bug et souhaite qu’il soit corrigé

Merci de créer un [issue GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/issues) et de fournir toutes les informations sur le problème rencontré.

Vous devrez probablement fournir les logs de debug. Voir la question suivante pour savoir comment obtenir ces logs.

### Comment activer et obtenir les logs de debug

Assurez-vous d’utiliser [v1.2.0](https://github.com/andyfase/egmp-bluelink-scriptable/releases) ou une version supérieure, car cette version facilite l’accès aux logs.

Dans l’écran des paramètres de l’application, activez l’option "Debug logs". Une fois activée, chaque requête et réponse API sera enregistrée dans un fichier.

Effectuez ensuite les actions pour lesquelles vous souhaitez obtenir les logs (simulez le bug). Ensuite, triple-cliquez sur l’icône des paramètres et choisissez "Share Debug Logs". Une fenêtre de partage s’ouvrira, vous permettant de sélectionner votre application mail pour envoyer les logs. Les informations personnelles (nom d’utilisateur, mot de passe, PIN, etc.) sont automatiquement masquées.

### Comment obtenir la liste complète des logs de debug ?

Si vous souhaitez consulter les logs en dehors de l’app, ils sont stockés dans le répertoire Scriptable sur iCloud Drive. Le fichier en cours d’utilisation s’appelle `egmp-bluelink.log`. Les fichiers sont automatiquement renommés lorsqu’ils atteignent 100 Ko, par exemple : `egmp-bluelink.log.20250318150755-0700`.

Tous les fichiers de logs sont dans le même répertoire Scriptable que les scripts. Comme indiqué ci-dessus, ces fichiers peuvent contenir vos identifiants. Si vous les fournissez par mail ou via un issue GitHub, assurez-vous de **masquer vos identifiants** avant envoi (login et mot de passe).
