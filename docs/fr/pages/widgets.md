---
title: Widgets
layout: home
nav_order: 2
lang: fr
permalink: /pages/widgets.html
---

# Support des widgets
{: .fs-9 }

Bluelink Scriptable prend en charge les widgets d'écran de verrouillage et d'écran d'accueil.
{: .fs-6 .fw-300 }

Tous les widgets permettent d'accéder à l'application principale en un seul clic et de mettre à jour automatiquement les données du véhicule en arrière-plan.
{: .fs-5 .fw-300 }

{: .info-title }
> Actualisation à distance des widgets
>
> Il est à noter que la mise à jour automatique des données du véhicule est « opt-in » : vous devez activer le paramètre « Enable widget remote refresh » dans l'écran des paramètres pour activer cette fonctionnalité. Cette fonctionnalité envoie automatiquement des commandes de statut à distance au véhicule pour obtenir des données à jour.
>
> Ceci est nécessaire pour obtenir les dernières données directement du véhicule. Sans activer ce paramètre, votre widget affichera probablement des données obsolètes.
>
> Une décharge de la batterie 12V peut survenir si vous envoyez trop de commandes de rafraîchissement à distance. Les valeurs par défaut de l'application sont très conservatrices pour cette raison. Ne modifiez les paramètres avancés des widgets que si vous comprenez les conséquences potentielles.
{: .fs-5 .fw-300 }

## Widgets d'écran d'accueil

Ces widgets peuvent être ajoutés à votre écran d'accueil. [Voir les instructions Apple](https://support.apple.com/en-ca/118610). Ce sont des widgets plus grands qui peuvent afficher plus d'informations et être placés sur n'importe quel écran d'accueil.
{: .fs-5 .fw-300 }

<table border="0" class="noBorder">
<tr>
<td width="40%">
<img src="../images/widget_home_big.png" width="500"/>
</td>
<td>
<p><b>Taille moyenne</b></p>
<p>Affiche le nom du véhicule (surnom si défini, sinon le nom du modèle), une grande image du véhicule et des informations sur la capacité de la batterie et l'autonomie. Si le véhicule est en charge ou branché, des icônes s'affichent en conséquence avec la puissance de charge et l'heure estimée de fin de charge. L'odomètre et la date/heure du dernier contrôle de statut à distance sont également visibles.</p>
</td>
</tr>
<tr>
<td>
<img src="../images/widget_home_small.png" width="150"/>
</td>
<td>
<p><b>Petite taille</b></p>
<p>Affiche une petite image du véhicule et des informations sur la capacité de la batterie et l'autonomie. Si le véhicule est en charge ou branché, des icônes s'affichent en conséquence avec la puissance de charge et l'heure estimée de fin de charge. La date/heure du dernier contrôle de statut à distance est également visible.</p>
</td>

</tr>
</table>

## Widgets d'écran de verrouillage

Ces widgets peuvent être ajoutés à votre écran de verrouillage. [Voir les instructions Apple](https://support.apple.com/en-ca/118610). Ces widgets sont petits, transparents et s'harmonisent avec les autres widgets d'écran de verrouillage Apple (météo, etc.).
{: .fs-5 .fw-300 }

<table border="0" class="noBorder">

<tr>
<td width="40%">
<img src="../images/widget_lock_big.png" width="300"/>
</td>
<td>
<p><b>Grande taille</b></p>
<p>Affiche un « cercle de batterie » reflétant la capacité de la batterie. Affiche également l'autonomie disponible, le pourcentage exact de la batterie et, en cas de charge, l'heure estimée de fin de charge.</p>
<p>Notez que l'image du véhicule change selon que le véhicule est en charge ou non.</p>
</td>
</tr>

<tr>
<td>
<img src="../images/widget_lock_small.png" width="100"/>
</td>
<td>
<p><b>Petite taille</b></p>
<p>Affiche uniquement le « cercle de batterie » reflétant la capacité de la batterie.</p>
<p>Notez que l'image du véhicule change selon que le véhicule est en charge ou non.</p>
</td>

</tr>

<tr >
<td>
<img src="../images/widget_lock_inline.png" width="400"/>
</td>
<td>
<p><b>Taille en ligne</b></p>
<p>Ce widget est disponible pour l'affichage au-dessus de l'heure sur l'écran d'accueil.</p>
<p>Affiche une version modifiée du « cercle de batterie » avec des icônes pour indiquer la charge / le branchement. Le texte montre l'autonomie disponible et, en cas de charge, l'heure estimée de fin de charge.</p>
</td>
</tr>

</table>

----
