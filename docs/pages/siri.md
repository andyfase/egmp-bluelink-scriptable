---
title: Siri / Raccourcis
layout: home
nav_order: 5
---

# Support Siri et Raccourcis
{: .fs-9 }

L'application supporte l'interaction directe avec Siri via l'application IOS "Raccourcis". Une collection de liens de téléchargement de Raccourcis est fournie ci-dessous. Ceux-ci peuvent être utilisés à la fois en parlant à Siri ou via l'[interaction avec le Centre de Contrôle IOS](./control-center.md).
{: .fs-5 .fw-300 }

## Raccourcis Communs

Ces raccourcis peuvent être utilisés via Siri ou via le [Centre de Contrôle](./control-center.md).

### Verrouiller la voiture - "Hey Siri, verrouille la voiture"
[Installer le raccourci "Lock Car"](https://www.icloud.com/shortcuts/5b569f78ef00452b9d7fe4455635d36d)
{: .fs-5 .fw-300 }

### Déverrouiller la voiture - "Hey Siri, déverrouille la voiture"
[Installer le raccourci "Unlock the Car"](https://www.icloud.com/shortcuts/631cb0865dfc4358837485410eb2a46f)
{: .fs-5 .fw-300 }

### Chauffer la voiture - "Hey Siri, chauffe la voiture"
[Installer le raccourci "Warm the Car"](https://www.icloud.com/shortcuts/ea24582e07e44edea66b0d7a9773ea75)
{: .fs-5 .fw-300 }

### Refroidir la voiture - "Hey Siri, refroidis la voiture"
[Installer le raccourci "Cool the Car"](https://www.icloud.com/shortcuts/486487c8d3c841feb9d4b46476eef294)
{: .fs-5 .fw-300 }

## Raccourci "Demande à la voiture"
[Installer le raccourci "Ask the Car"](https://www.icloud.com/shortcuts/b3bd704fa2bf4c6dabceec096c291342)
{: .fs-5 .fw-300 }

Une fois installé, interagissez avec le raccourci en disant **"Hey Siri, demande à la voiture"**. Siri répondra par **"Quelle commande ?"** et vous pourrez répondre avec une phrase en langage naturel, qui sera transmise à l'application. L'application identifie les commandes en détectant certains mots-clés, listés ci-dessous.
{: .fs-5 .fw-300 }

Une interaction commence lorsque vous demandez à Siri d'exécuter le nom du raccourci, ici nommé "Demande à la voiture". Par exemple :
{: .fs-5 .fw-300 }

**Vous : "Hey Siri, demande à la voiture"**  *(Lancer le raccourci)*  
**Siri : "Quelle commande ?"**  *(Le raccourci demande une entrée)*  
**Vous : "Quel est le statut de la voiture ?"**  *(Votre entrée est envoyée à l'application)*  
**Siri : "La batterie de votre Ioniq 5 est à 75 % et la voiture est verrouillée. Elle est en charge à 6 kW et sera terminée à 21h."** *(Réponse de l'application lue par Siri)*
{: .fs-5 .fw-400 }

Vous pouvez changer le nom du raccourci ou le texte du prompt — mais si vous changez le nom, c’est ce que vous devrez dire pour démarrer l’interaction.
{: .fs-5 .fw-300 }

## Mots-clés supportés

Les mots-clés suivants sont supportés :
{: .fs-5 .fw-400 }

### Statut

Retourne le statut le plus récent de la voiture depuis l’API Bluelink. Typiquement, une phrase indiquant l’état de charge, si la voiture est verrouillée et si elle est en charge (et si oui, quand la charge sera terminée).
{: .fs-5 .fw-400 }

Exemple : "Quel est le **statut** de la voiture ?"
{: .fs-5 .fw-400 }

### Statut à distance

Envoie une commande de statut à distance pour obtenir les informations les plus récentes. Après cela, il faudra attendre environ 30 secondes pour exécuter une commande de statut normale pour récupérer les données.
{: .fs-5 .fw-400 }

Exemple : "Quel est le **statut à distance** de la voiture ?"
{: .fs-5 .fw-400 }

### Verrouiller

Envoie une commande de verrouillage à distance.
{: .fs-5 .fw-400 }

Exemple : "Veuillez **verrouiller** la voiture"
{: .fs-5 .fw-400 }

### Déverrouiller

Envoie une commande de déverrouillage à distance.
{: .fs-5 .fw-400 }

Exemple : "Veuillez **déverrouiller** la voiture"
{: .fs-5 .fw-400 }

### Refroidir

Envoie une commande de pré-refroidissement de la voiture.
{: .fs-5 .fw-400 }

Exemple : "Pouvez-vous commencer à **refroidir** la voiture ?"
{: .fs-5 .fw-400 }

### Chauffer

Envoie une commande de pré-chauffage de la voiture.
{: .fs-5 .fw-400 }

Exemple : "Pouvez-vous commencer à **chauffer** la voiture ?"
{: .fs-5 .fw-400 }

### Climat off

Envoie une commande pour arrêter la climatisation.
{: .fs-5 .fw-400 }

Exemple : "Éteins la **climatisation** s'il te plaît"
{: .fs-5 .fw-400 }

### Climat personnalisé

Envoie une commande pour démarrer la climatisation selon votre configuration personnalisée (créée dans les paramètres). Cette option se déclenche avec le mot "climat" suivi du nom de la configuration.

Exemple : pour une configuration nommée "Super Chaud", vous diriez :  
"Allume la **climatisation super chaud** s'il te plaît"
{: .fs-5 .fw-400 }

### Démarrer la charge

Envoie une commande pour démarrer la charge de la voiture.
{: .fs-5 .fw-400 }

Exemple : "**Démarrer la charge** de la voiture"
{: .fs-5 .fw-400 }

### Arrêter la charge

Envoie une commande pour arrêter la charge de la voiture.
{: .fs-5 .fw-400 }

Exemple : "**Arrêter la charge** de la voiture"
{: .fs-5 .fw-400 }

### Définir les limites de charge

Envoie une commande pour définir la limite de charge de la voiture (pourcentage de batterie où arrêter la charge).
{: .fs-5 .fw-400 }

Exemple : "Définir **Limite de charge RoadTrip**"
{: .fs-5 .fw-400 }

### Données

Mot-clé avancé pour extraire le statut de la voiture dans un dictionnaire de Raccourci pour utilisation ultérieure (ex. vérifier l’autonomie pour un road-trip).  

Le format des données extraites :  

{
"car": {
"id": string,
"vin": string,
"nickName": string,
"modelName": string,
"modelYear": string,
"modelColour": string,
"modelTrim": string
},
"status": {
"lastStatusCheck": int,
"lastRemoteStatusCheck": int,
"isCharging": boolean,
"isPluggedIn": boolean,
"chargingPower": int,
"remainingChargeTimeMins": int,
"range": int,
"locked": boolean,
"climate": boolean,
"soc": int,
"twelveSoc": int,
"odometer": float,
"location": {
"latitude": string,
"longitude": string
},
"chargeLimit": {
"dcPercent": int,
"acPercent": int
}
}
}

Exemple : "**données**"
{: .fs-5 .fw-400 }