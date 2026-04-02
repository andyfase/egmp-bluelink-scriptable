---
title: Aide
layout: home
nav_order: 8
lang: fr
permalink: /pages/faq.html
---

# Aide / FAQ
{: .fs-9 }

Vous trouverez ci‑dessous une liste de questions fréquentes et/ou de problèmes courants, avec leurs solutions possibles.
{: .fs-5 .fw-300 }

### Est‑ce une vraie application, et si non pourquoi ?

Non, il ne s'agit pas d'une application distribuée sur l'App Store d'Apple. C'est un « app » ou script pour [Scriptable](https://scriptable.app/). Vous devez donc installer l'application Scriptable depuis l'App Store puis importer/installer le script fourni dans ce dépôt. Tout est documenté dans la [page d'installation](./install.md).

Pourquoi ce choix ? Parce que c'est plus simple à développer et à déployer de cette façon, et cela évite certaines contraintes imposées par l'App Store. Cette application utilise des API Hyundai et Kia non documentées ; cela rend la publication sur l'App Store plus compliquée et sujette à des restrictions.

### Le support Android est‑il prévu ?

Non, cette application est uniquement pour iOS et il n'est pas prévu pour l'instant de version Android. [Scriptable](https://scriptable.app/) n'existe que sur iOS ; l'équivalent Android le plus proche serait Tasker. Pour porter ceci sur Android, il faudrait développer une application native ou en React Native et la distribuer (probablement en sideload). Ce projet actuel ne couvre pas cela.

### Ai‑je besoin d'un abonnement Bluelink Kia / Hyundai pour utiliser l'application ?

Oui, en général. L'application utilise les mêmes API Hyundai/Kia que les applications officielles ; il est donc supposé que vous ayez un compte Bluelink actif et les droits nécessaires pour contrôler le véhicule depuis ces API.

### Mes identifiants Bluelink sont‑ils en sécurité si je les entre dans l'application ?

Oui. Toutes les configurations (y compris votre nom d'utilisateur, mot de passe et code PIN Bluelink) sont stockées localement dans le trousseau iOS (iOS keychain). Les identifiants ne sont exposés que si vous activez les logs de débogage (Debug Logging) et partagez ensuite ces logs. Faites attention aux logs avant de les partager.

### Quels pays / constructeurs sont pris en charge ?

Voir la page [Régions](./region.md) pour la liste des régions prises en charge et les limitations éventuelles.

### Les véhicules à moteur thermique (ICE) sont‑ils pris en charge ?

Pas pour l'instant. Cette application a été développée spécifiquement pour les véhicules électriques Hyundai / Kia basés sur la plateforme E‑GMP. Le support des véhicules à moteur thermique (ICE) a été demandé et pourra être envisagé, mais n'est pas encore implémenté. Si vous souhaitez le support ICE, veuillez ouvrir une issue sur [GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/issues) pour en discuter.

### J'ai saisi mes identifiants de façon incorrecte et l'application ne s'ouvre plus / ne fait rien

Vous devrez réinitialiser la configuration stockée. Un script de « reset » est fourni dans les [releases GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/releases). Téléchargez le fichier « egmp-reset.js » sous Assets dans votre répertoire Scriptable et exécutez-le pour réinitialiser la configuration.

### J'ai trouvé un bug et j'aimerais qu'il soit corrigé

Veuillez ouvrir une [issue GitHub](https://github.com/andyfase/egmp-bluelink-scriptable/issues) et fournir toutes les informations concernant le problème rencontré. Il est probable que des logs de débogage soient nécessaires — voir la question suivante.

### Comment activer et obtenir les logs de débogage ?

Assurez‑vous d'utiliser la version v1.2.0 (ou supérieure), car cette version facilite l'accès aux logs de débogage.

Une fois sur une version compatible, allez dans l'écran des paramètres de l'application et activez l'option « Debug logs ». Lorsqu'elle est activée, chaque requête et réponse API envoyée par l'application est consignée dans les logs.

Exécutez ensuite les actions nécessaires pour reproduire le bug. Quand vous avez terminé, effectuez un triple‑appui sur l'icône des paramètres et choisissez « Share Debug Logs ». Un écran de partage s'ouvrira vous permettant d'envoyer les logs. Les logs sont automatiquement expurgés de toute information personnelle (nom d'utilisateur, mot de passe, code PIN, etc.).

### Comment obtenir la liste complète des fichiers de logs en dehors de l'application ?

Les fichiers de logs sont stockés dans le répertoire Scriptable sur iCloud Drive. Le fichier actif est nommé `egmp-bluelink.log`. Les fichiers de logs sont automatiquement renommés lorsqu'ils atteignent 100 ko. Vous verrez donc des fichiers anciens nommés `egmp-bluelink.log.20250318150755-0700` ou similaires. L'horodatage correspond à la date de renommage du fichier.

Tous les fichiers de logs se trouvent dans le même répertoire Scriptable que les scripts eux-mêmes. Attention : ces fichiers de logs peuvent contenir vos identifiants. Si on vous demande de fournir des logs, veuillez les vérifier et supprimer ou masquer vos identifiants avant de les partager.

----
