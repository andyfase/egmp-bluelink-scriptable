---
title: Automatisations
layout: home
nav_order: 6
lang: fr
translation_key: automations
permalink: /fr/pages/automations
---

# Automatisations
{: .fs-9 }

En utilisant les Raccourcis iOS, il est possible de configurer plusieurs automatisations. Une automatisation associe un raccourci défini à une automatisation iOS qui déclenchera ce raccourci en fonction d'un événement (par ex. heure, déconnexion Bluetooth, etc.).
{: .fs-5 .fw-300 }

Toute automatisation basée sur un raccourci doit invoquer l'application avec une commande donnée — sous forme de chaîne de texte. La liste des commandes est décrite sur la page [Siri](/pages/siri).
{: .fs-5 .fw-300 }

## Exemples d'automatisations

Voici quelques exemples d'automatisations et des raccourcis Shortcuts téléchargeables. Les raccourcis fournis sont des exemples et doivent être modifiés par vos soins pour correspondre à ce que vous souhaitez réaliser.
{: .fs-5 .fw-300 }

### Verrouillage automatique à l'éloignement

{: .warning-title }
> Attention : vous pouvez vous retrouver enfermé hors de votre voiture en utilisant cette fonctionnalité.
>
> Le verrouillage via Bluelink verrouille toujours, quel que soit l'emplacement de vos clés. Ainsi, l'auto-verrouillage via Bluelink signifie que si vous coupez le contact, laissez vos clés dans la voiture et quittez le véhicule, les portes se verrouilleront.
>
> Si vous utilisez cette fonctionnalité, ne quittez jamais le véhicule sans disposer d'une de vos clés ou de votre téléphone avec l'application installée (afin de pouvoir déverrouiller si nécessaire).

Cette automatisation enverra une commande de verrouillage au véhicule après un délai. L'événement déclencheur peut être la déconnexion de CarPlay ou la déconnexion du Bluetooth du véhicule.

[Installer le raccourci « Auto Lock Car »](https://www.icloud.com/shortcuts/2b49acde29904725b31c64f8195074ce)
{: .fs-5 .fw-300 }

Pour configurer l'automatisation, procédez comme suit :

- Cliquez sur l'onglet Automatisations
- Appuyez sur le bouton plus (+)
- Choisissez soit "Bluetooth" soit "CarPlay"
- Sélectionnez "Est déconnecté" comme déclencheur (pas connecté), choisissez l'appareil (par ex. le nom Bluetooth ou CarPlay du véhicule). Enfin, sélectionnez "Exécuter immédiatement"

### Jour de travail : réchauffer automatiquement la voiture si elle est froide

Cette automatisation enverra une commande de chauffe au véhicule selon un calendrier défini (par ex. 7 h les jours ouvrables), si la température extérieure est inférieure à une valeur donnée.

[Installer le raccourci « Auto Warm Car »](https://www.icloud.com/shortcuts/804d551c2816436698ba97838ea66c26)
{: .fs-5 .fw-300 }

Pour configurer l'automatisation, procédez comme suit :

- Cliquez sur l'onglet Automatisations
- Appuyez sur le bouton plus (+)
- Choisissez "Heure de la journée"
- Sélectionnez l'heure à laquelle vous souhaitez que l'automatisation s'exécute, choisissez "Hebdomadaire" et sélectionnez les jours de la semaine où vous voulez qu'elle s'exécute. Enfin, sélectionnez "Exécuter immédiatement"

### Régler la limite de charge à 100 % une fois par mois

Hyundai / Kia recommandent de charger à 100 % une fois par mois ; cela peut être difficile à se rappeler. Cette automatisation est utile si vous chargez habituellement quotidiennement (ou régulièrement) et que vous souhaitez automatiser ce réglage ponctuel.

Cette automatisation enverra une commande de limite de charge au véhicule selon un calendrier défini. Dupliquez-la pour la remettre à la valeur normale le lendemain.

[Installer le raccourci « Auto Charge Limit »](https://www.icloud.com/shortcuts/2c499728f55d43aa90ba9b68792fe9df)
{: .fs-5 .fw-300 }

Modifiez le script pour définir le réglage de charge de votre choix ; par défaut il est défini sur "RoadTrip". Vous souhaiterez probablement créer votre propre réglage de limite de charge dans les paramètres de configuration de l'application.

Pour configurer l'automatisation, procédez comme suit :

- Cliquez sur l'onglet Automatisations
- Appuyez sur le bouton plus (+)
- Choisissez "Heure de la journée"
- Sélectionnez l'heure à laquelle vous souhaitez que l'automatisation s'exécute, choisissez "Mensuel" et sélectionnez le jour du mois auquel vous voulez qu'elle s'exécute. Enfin, sélectionnez "Exécuter immédiatement"

Dupliquez le script et l'automatisation pour rétablir ensuite la limite de charge à sa valeur normale.
{: .fs-5 .fw-300 }
