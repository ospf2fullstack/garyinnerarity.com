$('#parallax').parallax({
	invertX: true,
	invertY: true,
	scalarX: .01,
	 frictionY: .01
});


particlesJS("particles-js", {
  "particles": {
    "number": {
      "value": 50,
      "density": {
        "enable": true,
        "value_area": 1815.039575754227
      }
    },
    "color": {
      "value": "#304656" /* center of orb */
    },
    "shape": {
      "type": "circle",
      "stroke": {
        "width": 2,
        "color": "#304656"
      },
      "polygon": {
        "nb_sides": 3
      },
      "image": {
        "src": "img/github.svg",
        "width": 100,
        "height": 100
      }
    },
    "opacity": {
      "value": 0.5,
      "random": false,
      "anim": {
        "enable": true,
        "speed": 0.8120772123013451,
        "opacity_min": 0.1,
        "sync": false
      }
    },
    "size": {
      "value": 20.042650760819036,
      "random": true,
      "anim": {
        "enable": true,
        "speed": 4.872463273808071,
        "size_min": 0.1,
        "sync": false
      }
    },
    "line_linked": {
      "enable": true,
      "distance": 189.39543399174545,
      "color": "#304656", // more color for orbs
      "opacity": 1,
      "width": 1
    },
    "move": {
      "enable": true,
      "speed": 3.206824121731046,
      "direction": "none",
      "random": true,
      "straight": false,
      "out_mode": "bounce",
      "bounce": false,
      "attract": {
        "enable": false,
        "rotateX": 600,
        "rotateY": 1200
      }
    }
  },
  "interactivity": {
    "detect_on": "canvas",
    "events": {
      "onhover": {
        "enable": true,
        "mode": "bubble"
      },
      "onclick": {
        "enable": true,
        "mode": "push"
      },
      "resize": true
    },
    "modes": {
      "grab": {
        "distance": 400,
        "line_linked": {
          "opacity": 1
        }
      },
      "bubble": {
        "distance": 97.44926547616143,
        "size": 28.42270243054708,
        "duration": 3.329516570435515,
        "opacity": 1,
        "speed": 30
      },
      "repulse": {
        "distance": 200,
        "duration": 0.4
      },
      "push": {
        "particles_nb": 4
      },
      "remove": {
        "particles_nb": 2
      }
    }
  },
  "retina_detect": true
});