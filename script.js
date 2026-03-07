// 1. Conectar las variables con el HTML
const objetivo = document.getElementById("objetivo");
const btnIniciar = document.getElementById("btn-iniciar");
const textoPuntaje = document.getElementById("puntaje");
const textoTiempo = document.getElementById("tiempo");
const areaJuego = document.getElementById("area-juego");

// 2. Variables de estado del juego
let puntos = 0;
let tiempoRestante = 10;
let temporizador;

// 3. Función para mover el pollito aleatoriamente
function moverObjetivo() {
    // Calculamos el espacio máximo disponible para que no se salga de la caja
    const maxAncho = areaJuego.clientWidth - 50; 
    const maxAlto = areaJuego.clientHeight - 50;

    // Generamos coordenadas X e Y aleatorias
    const randomX = Math.floor(Math.random() * maxAncho);
    const randomY = Math.floor(Math.random() * maxAlto);

    // Aplicamos las coordenadas
    objetivo.style.left = randomX + "px";
    objetivo.style.top = randomY + "px";
}

// 4. ¿Qué pasa cuando le hacemos clic al pollito?
objetivo.addEventListener("click", function() {
    puntos++; // Sumamos un punto
    textoPuntaje.innerText = puntos; // Actualizamos la pantalla
    moverObjetivo(); // Lo cambiamos de lugar inmediatamente
});

// 5. Función principal para arrancar el juego
btnIniciar.addEventListener("click", function() {
    // Reiniciamos todo
    puntos = 0;
    tiempoRestante = 10;
    textoPuntaje.innerText = puntos;
    textoTiempo.innerText = tiempoRestante;
    
    btnIniciar.disabled = true; // Apagamos el botón de inicio
    objetivo.classList.remove("oculto"); // Mostramos el pollito
    moverObjetivo();

    // Arrancamos el reloj que resta 1 segundo cada 1000 milisegundos
    temporizador = setInterval(function() {
        tiempoRestante--;
        textoTiempo.innerText = tiempoRestante;

        if (tiempoRestante <= 0) {
            // El tiempo se acabó
            clearInterval(temporizador); // Detenemos el reloj
            objetivo.classList.add("oculto"); // Escondemos el pollito
            btnIniciar.disabled = false; // Prendemos el botón de nuevo
            alert("¡Tiempo terminado! Lograste atrapar al pollito " + puntos + " veces.");
        }
    }, 1000);
});