---
title: Siri / Raccourcis
layout: home
nav_order: 5
lang: fr
permalink: /pages/siri.html
---

# Raccourcis Siri
{: .fs-9 }

L'application supporte les interactions avec Siri grâce à l'app « Raccourcis » d'iOS. Plusieurs liens de téléchargement de raccourcis sont disponibles ci-dessous. Ils peuvent être utilisés autant pour demander à Siri que via le [centre de contrôle iOS](./control-center.md).
{: .fs-5 .fw-300 }

## Commandes courantes

Les raccourcis peuvent être utilisés via Siri ou le [centre de contrôle](./control-center.md).

### Lock the Car - « Dis Siri, Lock the car »
[Installer le raccourci « Lock Car »](https://www.icloud.com/shortcuts/5b569f78ef00452b9d7fe4455635d36d)
{: .fs-5 .fw-300 }

### UnLock the Car - « Dis Siri, Unlock the car »
[Installer le raccourci « Unlock the Car »](https://www.icloud.com/shortcuts/631cb0865dfc4358837485410eb2a46f)
{: .fs-5 .fw-300 }

### Warm the Car - « Dis Siri, warm the car »
[Installer le raccourci « Warm the Car »](https://www.icloud.com/shortcuts/ea24582e07e44edea66b0d7a9773ea75)
{: .fs-5 .fw-300 }

### Cool the Car - « Dis Siri, Cool the car »
[Installer le raccourci « Cool the Car »](https://www.icloud.com/shortcuts/486487c8d3c841feb9d4b46476eef294)
{: .fs-5 .fw-300 }



## Raccourci « Ask the Car »
[Installer le raccourci « Ask the Car »](https://www.icloud.com/shortcuts/b3bd704fa2bf4c6dabceec096c291342)
{: .fs-5 .fw-300 }

Une fois installé, interagissez avec le raccourci en disant **« Dis Siri, Ask the car »**. Siri répondra en demandant **« Whats the Command? »** et vous pourrez répondre avec une phrase en langage naturel, qui sera transmise à l'application. L'application identifie les commandes en correspondant à des mots-clés spécifiques, listés ci-dessous.
{: .fs-5 .fw-300 }

Une interaction commence par vous demander à Siri d'exécuter le nom du raccourci, dans ce cas nommé « Ask the Car », donc une interaction ressemble à :
{: .fs-5 .fw-300 }

**Vous : « Dis Siri, Ask the car »**  *(Ceci exécute le raccourci)*
**Siri : « Whats the Command? »**  *(Le raccourci demande une entrée)*
**Vous : « What's the status of the car? »**  *(Votre entrée sera envoyée à l'application)*
**Siri : « Your Ioniq 5's battery is at 75% and locked. Your car is also charging at 6kw and will be finished at 9pm »** *(C'est la réponse de l'application que Siri vous lira)*
{: .fs-5 .fw-400 }

Vous pouvez changer le nom du raccourci ou le texte de commande — rappelez-vous simplement que si vous changez le nom, c'est ce que vous devrez dire pour démarrer l'interaction.
{: .fs-5 .fw-300 }

## Mots-clés supportés

Les mots-clés suivants sont supportés :
{: .fs-5 .fw-400 }

### Status

Retourne le dernier statut du véhicule depuis l'API Bluelink. Généralement une phrase indiquant le statut de charge, si le véhicule est verrouillé et s'il est en charge (et quand la charge sera terminée).
{: .fs-5 .fw-400 }

Exemple : « What's the **status** of the car? »
{: .fs-5 .fw-400 }

### Remote Status

Envoie une commande de statut à distance au véhicule pour obtenir les informations les plus récentes. Une commande de statut normale devra être envoyée environ 30 secondes plus tard pour récupérer ces informations.
{: .fs-5 .fw-400 }

Exemple : « What's the **remote status** of the car? »
{: .fs-5 .fw-400 }

### Lock

Envoie une commande de verrouillage à distance au véhicule.
{: .fs-5 .fw-400 }

Exemple : « Please **lock** the car? »
{: .fs-5 .fw-400 }

### Unlock

Envoie une commande de déverrouillage à distance au véhicule.
{: .fs-5 .fw-400 }

Exemple : « Please **unlock** the car? »
{: .fs-5 .fw-400 }

### Cool

Envoie une commande à distance pour pré-refroidir le véhicule.
{: .fs-5 .fw-400 }

Exemple : « Can you start **cooling** the car? »
{: .fs-5 .fw-400 }

### Warm

Envoie une commande à distance pour pré-chauffer le véhicule.
{: .fs-5 .fw-400 }

Exemple : « Can you start **warming** the car? »
{: .fs-5 .fw-400 }

### Climate off

Envoie une commande à distance pour arrêter la climatisation du véhicule.
{: .fs-5 .fw-400 }

Exemple : « Turn the **climate off** please »
{: .fs-5 .fw-400 }

### Custom Climate Start

Envoie une commande à distance pour démarrer la climatisation selon votre configuration personnalisée (créée dans les paramètres). Cette option est déclenchée par le mot « climate » plus le nom de la configuration personnalisée.

Par exemple, avec une configuration nommée « Super Hot » :

Exemple : « Turn on **climate super hot** please »

### Start charging

Envoie une commande à distance pour démarrer la charge du véhicule.
{: .fs-5 .fw-400 }

Exemple : « **Start charging** the car »
{: .fs-5 .fw-400 }

### Stop charging

Envoie une commande à distance pour arrêter la charge du véhicule.
{: .fs-5 .fw-400 }

Exemple : « **Stop charging** the car »
{: .fs-5 .fw-400 }

### Set Charge Limits
Envoie une commande à distance pour définir la limite de charge nommée du véhicule (c.-à-d. le pourcentage de batterie auquel la charge s'arrête).
{: .fs-5 .fw-400 }

Exemple : « Set **Charge Limit RoadTrip** »
{: .fs-5 .fw-400 }

### Data
Mot-clé avancé qui peut être utilisé dans les Raccourcis iOS pour extraire le statut du véhicule dans un dictionnaire de raccourcis pour une utilisation ultérieure. Ces données peuvent ensuite être utilisées dans n'importe quelle condition souhaitée. Par exemple, vous pourriez définir un raccourci qui vérifie chaque soir l'autonomie du véhicule par rapport aux entrées du calendrier et alerte si un road-trip est prévu et que l'autonomie est faible.
{: .fs-5 .fw-400 }

Les données extraites sont au format suivant :

```
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
        "lastStatusCheck": int # epoch_milliseconds_since_last_api_status,
        "lastRemoteStatusCheck": int # <epoch_milliseconds_since_last_remote_api_status>,
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
```

Exemple : « **data** »
{: .fs-5 .fw-400 }
