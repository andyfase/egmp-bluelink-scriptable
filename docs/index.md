---
title: Accueil
nav_order: 1
layout: home
lang: fr
translation_key: homepage
permalink: /fr/
---

# Application Scriptable Hyundai / Kia E‑GMP pour iOS
{: .fs-8 }

Une [application Scriptable](https://scriptable.app/) pour iOS qui vous permet de contrôler votre voiture Hyundai / Kia E‑GMP via l'API Bluelink.  
Considérez-la comme une application compagnon de l'application officielle Bluelink, avec une interface plus moderne, plus réactive et des fonctionnalités étendues telles que le widget et la prise en charge de Siri.
{: .fs-6 .fw-300 }


<script>
function lightbox_open() {
  var lightBoxVideo = document.getElementById("VisaChipCardVideo");
  window.scrollTo(0, 0);
  document.getElementById('light').style.display = 'block';
  document.getElementById('fade').style.display = 'block';
  lightBoxVideo.play();
}

function lightbox_close() {
  var lightBoxVideo = document.getElementById("VisaChipCardVideo");
  document.getElementById('light').style.display = 'none';
  document.getElementById('fade').style.display = 'none';
  lightBoxVideo.pause();
}
</script>

<div id="light">
  <a class="boxclose" id="boxclose" onclick="lightbox_close();"></a>
  <video id="VisaChipCardVideo" height="680" autoplay controls>
      <source src="../images/egmp-scriptable-in-use.mp4" type="video/mp4">
      <!--Browser does not support <video> tag -->
    </video>
</div>

<div id="fade" onClick="lightbox_close();"></div>

<table border="0" class="noBorder">
<tr>
<td width="55%"><a href="#" onclick="lightbox_open();"><img src="../images/widget_charging.png" width="400" /></a>
<br/><center>Cliquez pour afficher l'application en action</center>
</td>
<td>

<p>
<a href="/fr/pages/install" class="btn btn-primary fs-5 mb-4 mb-md-0 mr-2">Instructions d'installation</a>
</p>
<p>
<a href="https://github.com/andyfase/egmp-bluelink-scriptable" class="btn fs-5 mb-4 mb-md-0">Voir sur GitHub&#160;&#160;</a>
</p>
<p>
<a href="https://buymeacoffee.com/andyfase"><img src="../images/coffee.png" width="188"></a>
</p>

</td>
</tr>
</table>

Fonctionnalités :
{: .fs-6 .fw-300 }

- Widgets d'écran d'accueil et d'écran de verrouillage auto-mis à jour
- Interface plus moderne et plus réactive
- Options en un clic pour les commandes courantes (verrouiller, chauffer, charger, etc.) dans l'application et dans le Centre de contrôle iOS
- Prise en charge vocale Siri « Dis Siri, chauffe la voiture »
- Automatisations via Raccourcis iOS, par exemple verrouillage automatique à l'éloignement
- Configurations de climatisation personnalisées illimitées
{: .fs-6 .fw-300 }
