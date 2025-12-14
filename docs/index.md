---
title: Home
nav_order: 1
layout: home
---

# Hyundai / Kia E-GMP Application scriptable pour IOS
{: .fs-8 }

Une [application Scriptable](https://scriptable.app/) pour iOS qui vous permet de contrôler votre voiture électrique Hyundai / Kia en utilisant l'API Bluelink.
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
      <source src="./images/egmp-scriptable-in-use.mp4" type="video/mp4">
      <!--Browser does not support <video> tag -->
    </video>
</div>

<div id="fade" onClick="lightbox_close();"></div>

<table border="0" class="noBorder">
<tr>
<td width="55%"><a href="#" onclick="lightbox_open();"><img src="./images/widget_charging.png" width="400" /></a>
<br/><center>Cliquer ici pour voir l'application</center>
</td>
<td>

<p>
<a href="./pages/install" class="btn btn-primary fs-5 mb-4 mb-md-0 mr-2">Instruction pour l'installation</a>
</p>
<p>
<a href="https://github.com/bleeband/egmp-bluelink-scriptable" class="btn fs-5 mb-4 mb-md-0">Vooir sur GitHub&#160;&#160;</a>
</p>
<p>
<!-- <a href="https://buymeacoffee.com/andyfase"><img src="./images/coffee.png" width="188"></a> -->
</p>

</td>
</tr>
</table>

Fonctionnalités incluses :  
{: .fs-6 .fw-300 }

- Widgets sur l’écran d’accueil et l’écran verrouillé avec mise à jour automatique  
- Interface de l’application plus réactive et moderne  
- Options en un clic pour les commandes courantes (verrouiller, chauffer, charger, etc.) dans l’application et dans le Centre de contrôle iOS  
- Support vocal Siri : "Hey Siri, chauffe la voiture"  
- Automatisations via Raccourcis iOS, comme le verrouillage automatique à l’éloignement  
- Configurations climatiques personnalisées illimitées  
{: .fs-6 .fw-300 }
