---
title: Automatisations
layout: home
nav_order: 6
---

# Automatisations
{: .fs-9 }

Avec les raccourcis iOS, il est possible de configurer un certain nombre d’automatisations. Une automatisation est une combinaison d’un raccourci défini et d’une automatisation iOS qui déclenchera ce raccourci [en fonction d’un événement supporté par iOS](https://support.apple.com/en-ca/guide/shortcuts/apd932ff833f/ios). Tant le raccourci que l’automatisation sont créés dans l’application Raccourcis.
{: .fs-5 .fw-300 }

Toute automatisation de raccourci devra invoquer l’application avec une commande donnée — sous forme de chaîne de texte. La liste des commandes est décrite sur la page [Siri](./siri.md).
{: .fs-5 .fw-300 }

## Exemples d’automatisations

Voici quelques exemples d’automatisations, avec des scripts Raccourcis téléchargeables. Les raccourcis fournis sont des exemples et doivent être modifiés pour correspondre à ce que vous souhaitez accomplir.
{: .fs-5 .fw-300 }

### Verrouillage en s’éloignant

{: .warning-title }
> Attention : Vous pouvez vous enfermer hors de votre voiture avec cette fonctionnalité
>
> Le verrouillage via Bluelink verrouille toujours la voiture, quel que soit l’emplacement de vos clés. Ainsi, le verrouillage automatique via Bluelink signifie que si vous éteignez la voiture, laissez vos clés à l’intérieur et quittez la voiture avec les portes fermées, vous pouvez vous retrouver enfermé à l’extérieur.
>
> Si vous utilisez cette fonctionnalité, ne quittez jamais la voiture sans avoir une de vos clés ou votre téléphone avec l’application installée (pour pouvoir déverrouiller si nécessaire).

Cette automatisation enverra une commande de verrouillage à la voiture après un délai. L’événement déclencheur peut être la déconnexion de CarPlay ou la déconnexion du Bluetooth de la voiture.

[Installer le raccourci "Auto Lock Car"](https://www.icloud.com/shortcuts/2b49acde29904725b31c64f8195074ce)
{: .fs-5 .fw-300 }

Pour configurer l’automatisation, procédez comme suit :

- Cliquez sur l’onglet Automatisations
- Cliquez sur le plus (+)
- Choisissez soit "Bluetooth" soit "CarPlay"
- Sélectionnez "Est déconnecté" comme déclencheur (non connecté), choisissez l’appareil (ex. le Bluetooth de la voiture ou le nom de CarPlay). Enfin, sélectionnez "Exécuter immédiatement".

### Jour de travail : préchauffage automatique si la voiture est froide

Cette automatisation enverra une commande de chauffage à la voiture selon un horaire défini (7h, en semaine), si la température extérieure est inférieure à une valeur donnée.

[Installer le raccourci "Auto Warm Car"](https://www.icloud.com/shortcuts/804d551c2816436698ba97838ea66c26)
{: .fs-5 .fw-300 }

Pour configurer l’automatisation, procédez comme suit :

- Cliquez sur l’onglet Automatisations
- Cliquez sur le plus (+)
- Choisissez "Heure de la journée"
- Sélectionnez l’heure à laquelle cette automatisation doit s’exécuter, choisissez "Hebdomadaire" et sélectionnez les jours de la semaine où vous souhaitez qu’elle s’exécute. Enfin, sélectionnez "Exécuter immédiatement".

### Régler la limite de charge à 100 % une fois par mois

Hyundai/Kia recommande de charger à 100 % une fois par mois, ce qui peut être facile à oublier. Cette automatisation peut être utilisée si vous chargez quotidiennement (ou régulièrement) et que vous souhaitez automatiser le réglage de la limite de charge à 100 % une fois par mois, puis revenir à votre valeur normale ensuite.

Cette automatisation enverra une commande de limite de charge à la voiture selon un horaire défini. Dupliquez-la pour la remettre à la valeur normale le jour suivant.

[Installer le raccourci "Auto Charge Limit"](https://www.icloud.com/shortcuts/2c499728f55d43aa90ba9b68792fe9df)
{: .fs-5 .fw-300 }

Modifiez le script pour définir la limite de charge de votre choix. Par défaut, elle est définie sur "RoadTrip". Vous voudrez probablement créer votre propre réglage de limite de charge dans les paramètres de configuration de l’application d’abord.

Pour configurer l’automatisation, procédez comme suit :

- Cliquez sur l’onglet Automatisations
- Cliquez sur le plus (+)
- Choisissez "Heure de la journée"
- Sélectionnez l’heure à laquelle cette automatisation doit s’exécuter, choisissez "Mensuel" et sélectionnez le jour du mois où vous souhaitez qu’elle s’exécute. Enfin, sélectionnez "Exécuter immédiatement".

Dupliquez le script et l’automatisation pour remettre la limite de charge à sa valeur normale.
