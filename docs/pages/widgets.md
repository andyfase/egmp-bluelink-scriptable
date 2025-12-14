---
title: Widgets
layout: home
nav_order: 2
---

# Support des Widgets
{: .fs-9 }

Bluelink Scriptable supporte les widgets à la fois pour l'écran verrouillé et l'écran d'accueil.
{: .fs-6 .fw-300 }

Tous les widgets permettent un accès en un clic à l'application principale et tous permettent la mise à jour automatique des données de la voiture en arrière-plan.
{: .fs-5 .fw-300 }

{: .info-title }
> Actualisation distante du widget
>
> Il est important de noter que la mise à jour automatique des données de la voiture est "optionnelle" : vous devez cocher l'option "Activer l'actualisation distante du widget" dans l'écran des paramètres pour activer cette fonctionnalité. Cela enverra automatiquement des commandes de statut à distance intermittentes pour obtenir les données les plus récentes de votre voiture.
>
> Cela est nécessaire pour obtenir les données les plus récentes directement depuis la voiture. Sans cette option, votre widget affichera probablement toujours des données obsolètes.
>
> Une consommation de la batterie 12V peut survenir si trop de commandes d'actualisation sont envoyées. Les valeurs par défaut de l'application sont très conservatrices pour cette raison. Ne modifiez les paramètres avancés du widget que si vous comprenez les conséquences potentielles d'envoyer trop de commandes.
{: .fs-5 .fw-300 }

## Widgets Écran d'Accueil

Ces widgets peuvent être ajoutés à votre écran d'accueil. [Voir les instructions Apple pour le faire](https://support.apple.com/en-ca/118610). Ce sont des widgets plus grands qui peuvent afficher plus d'informations et être placés sur n'importe quel écran d'accueil.
{: .fs-5 .fw-300 }

<table border="0" class="noBorder">
<tr>
<td width="40%">
<img src="../images/widget_home_big.png" width="500"/>
</td>
<td>
<p><b>Taille Moyenne</b></p>
<p>Affiche le nom de la voiture (surnom si défini, sinon nom du modèle), une grande image de la voiture et les informations sur la capacité de batterie et l'autonomie. Si la voiture est en charge ou branchée, les icônes s'affichent en conséquence, et la puissance de charge ainsi que l'heure prévue de fin de charge seront indiquées. Enfin, l'odomètre et la date/heure de la dernière vérification de statut à distance seront également visibles.</p>
</td>
</tr>
<tr>
<td>
<img src="../images/widget_home_small.png" width="150"/>
</td>
<td>
<p><b>Petite Taille</b></p>
<p>Affiche une petite image de la voiture et les informations sur la capacité de batterie et l'autonomie. Si la voiture est en charge ou branchée, les icônes s'affichent en conséquence, et la puissance de charge ainsi que l'heure prévue de fin de charge seront indiquées. La date/heure de la dernière vérification de statut à distance sera également visible.</p>
</td>
</tr>
</table>

## Widgets Écran Verrouillé

Ces widgets peuvent être ajoutés à votre écran verrouillé. [Voir les instructions Apple pour le faire](https://support.apple.com/en-ca/118610). Ce sont de petits widgets transparents, assortis aux autres widgets de l'écran verrouillé Apple (météo, etc.).
{: .fs-5 .fw-300 }

<table border="0" class="noBorder">

<tr>
<td width="40%">
<img src="../images/widget_lock_big.png" width="300"/>
</td>
<td>
<p><b>Grande Taille</b></p>
<p>Affiche le "cercle de batterie" pour refléter la capacité de la batterie. Affiche également l'autonomie disponible, le pourcentage exact de la batterie et, si la voiture est en charge, l'heure prévue de fin de charge.</p>
<p>Note : l'image de la voiture change selon qu'elle est en charge ou non.</p>
</td>
</tr>

<tr>
<td>
<img src="../images/widget_lock_small.png" width="100"/>
</td>
<td>
<p><b>Petite Taille</b></p>
<p>Affiche uniquement le "cercle de batterie" pour refléter la capacité de la batterie.</p>
<p>Note : l'image de la voiture change selon qu'elle est en charge ou non.</p>
</td>
</tr>

<tr>
<td>
<img src="../images/widget_lock_inline.png" width="400"/>
</td>
<td>
<p><b>Taille Inline</b></p>
<p>Ce widget peut être affiché au-dessus de l'élément heure sur l'écran verrouillé.</p>
<p>Affiche une version modifiée du "cercle de batterie" avec des icônes indiquant si la voiture est en charge ou branchée. Le texte montre l'autonomie disponible et, si en charge, l'heure de fin de charge.</p>
</td>
</tr>

</table>

----
