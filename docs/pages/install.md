---
title: Installation
layout: home
nav_order: 4
---

# Instructions d'installation
{: .fs-9 }

{: .info-title }
> Ce n'est pas une application de l'App Store
>
> Bluelink Scriptable est une application "scriptable". C'est un script qui est lu dans [scriptable IOS app](https://scriptable.app/), comme une app dans une app. Cela signifie qu'il faut installer l'application Scriptable depuis l'App Store puis télécharger le Javascript dans l'application Scriptable de votre iPhone.
>
>Utiliser Scriptable signifie un temps de développement beaucoup plus rapide, pas de processus d'acceptation compliqué de la part d'apple et des mises à jour ultra rapides quand Kia ou Hyundai changent leur API! Vous aurez quand même l'impression d'utiliser une application incluant les widgets, raccourcis, Siri et bien plus!


> Il n'ya besoin que d'une seule installation. Une fois que c'est fait les mises à jour vous seront proposées à l'ouverture de l'app, quand disponibles, en un seul clic.
{: .fs-5 .fw-300 } 

## Étapes d'installation
Step 1: [Installer l'app Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188?uo=4)
puis l'ouvrir.
{: .fs-4 .fw-300 }

Step 2: [Télécharger la dernière version de egmp-bluelink.js](https://github.com/andyfase/egmp-bluelink-scriptable/releases) depuis votre iPhone.
{: .fs-4 .fw-300 }

![image](../images/download.png)

Step 3: Depuis l'application iOS **Fichiers**, déplacer le fichier `egmp-bluelink.js` du dossier téléchargements vers "iCloud Drive" -> "Scriptable".
{: .fs-4 .fw-300 }

Step 4: Ouvrir l'app Scriptable et sélectionner "egmp-bluelink". ça lancera l'app pour la premiere fois un écran de configuration s'affichera, vous demandant de rentrer vos informations de Bluelink et indiquer vos préférences.
{: .fs-4 .fw-300 }

> Note: Vos informations Bluelink sont stockées en sécurité dans votre trousseau Apple et l'app scriptable n'envoie jamais ces informations ailleurs qu'à l'API Bluelink, tout comme l'appli officielle Bluelink.

Step 5: Une fois vos informations entrées, cliquez sur enregistrer (save) et l'application fermera. Appuyez sur "egmp-bluelink" de nouveau et l'app s'ouvrira et sera utilisable!
{: .fs-5 .fw-300 }

Step 6: Créez un nouveau widget pour votre écran verrouillé ou écran d'Accueil. [Voir le guide Apple si beosin d'aide](https://support.apple.com/en-ca/118610). La [Page Widget](./widgets.md) vous montrera les widgets disponibles
{: .fs-5 .fw-300 }

Quand vous configurez le widget, veuillez vous assurer de :
{: .fs-5 .fw-300 }

- Choisir **"Scriptable"** depuis la liste des widgets
- Choisir la taille medium (la seule supportée)
- Rester appuyer sur votre widget pour le configurer
- Pour **"Script"** choisir **egmp-bluelink**
- Pour **"When Interacting"** choisir **Run Script**

Step 7: (Optionnel mais recommandé) Continuez en installant les [raccourcis Siri IOS](./siri.md) et les [Controles du centre de contrôle](./control-center.md)
{: .fs-5 .fw-300 }

Ça y est c'est fini! Profitez de bluelink-scriptable!
{: .fs-5 .fw-300 }

----
