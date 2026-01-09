// Импорт Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ТВОИ НАСТРОЙКИ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDwb1lT9GZCF1MViq71aXr1ggtMKYNK2qE",
    authDomain: "memory-4569e.firebaseapp.com",
    projectId: "memory-4569e",
    storageBucket: "memory-4569e.firebasestorage.app",
    messagingSenderId: "405838410040",
    appId: "1:405838410040:web:6aa0b8e8c15ad4eeef91cd",
    measurementId: "G-VEG2RSWXQT"
};

let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.warn("Ошибка Firebase:", e);
}

const tg = window.Telegram.WebApp;
tg.expand(); 

// --- КАРТИНКИ ---
const imageFiles = [
    'img/item1.png', 'img/item2.png', 'img/item3.png', 'img/item4.png',
    'img/item5.png', 'img/item6.png', 'img/item7.png', 'img/item8.png'
];

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let timer;
let timeElapsed = 0;
let isPlaying = false;

const user = tg.initDataUnsafe.user || { id: 'test_local', first_name: 'Игрок', photo_url: '' };

// --- ЭКРАНЫ ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    const screen = document.getElementById(screenId);
    screen.classList.remove('hidden');
    screen.classList.add('active');

    if (screenId === 'leaderboard-screen') loadLeaderboard();
}

// Кнопки
document.getElementById('btn-play').addEventListener('click', () => { showScreen('game-screen'); initGame(); });
document.getElementById('btn-leaders').addEventListener('click', () => showScreen('leaderboard-screen'));
// Кнопка домика удалена, поэтому удаляем и слушатель для нее
document.getElementById('btn-back-from-leaders').addEventListener('click', () => showScreen('menu-screen'));
document.getElementById('btn-menu-win').addEventListener('click', () => { document.getElementById('modal').classList.add('hidden'); showScreen('menu-screen'); });
document.getElementById('btn-restart').addEventListener('click', () => { document.getElementById('modal').classList.add('hidden'); initGame(); });

// --- ИГРА ---
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function initGame() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    matchedPairs = 0;
    timeElapsed = 0;
    flippedCards = [];
    document.getElementById('time').innerText = '0с';
    document.getElementById('score').innerText = '0';
    
    // Дублируем и мешаем
    cards = shuffle([...imageFiles, ...imageFiles]);

    // Создаем карты
    cards.forEach((imgSrc, index) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.index = index;
        card.dataset.img = imgSrc;

        // Вставляем картинки
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img src="${imgSrc}" alt="item">
                </div>
                <div class="card-back">
                    <img src="img/logo.png" alt="back">
                </div>
            </div>
        `;

        card.addEventListener('click', function() { flipCard(this); });
        board.appendChild(card);
    });

    clearInterval(timer);
    timer = setInterval(() => {
        timeElapsed++;
        document.getElementById('time').innerText = `${timeElapsed}с`;
    }, 1000);
    
    isPlaying = true;
}

function flipCard(card) {
    if (!isPlaying) return;
    if (flippedCards.length >= 2) return;
    if (card.classList.contains('flipped')) return;

    card.classList.add('flipped');
    flippedCards.push(card);

    if (flippedCards.length === 2) {
        checkMatch();
    }
}

function checkMatch() {
    const [card1, card2] = flippedCards;

    if (card1.dataset.img === card2.dataset.img) {
        matchedPairs++;
        flippedCards = [];
        if (matchedPairs === imageFiles.length) {
            endGame();
        }
    } else {
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            flippedCards = [];
        }, 750);
    }
}

function endGame() {
    clearInterval(timer);
    isPlaying = false;
    let score = Math.floor(10000 / (timeElapsed + 10));
    document.getElementById('final-time').innerText = timeElapsed;
    document.getElementById('final-score').innerText = score;
    document.getElementById('modal').classList.remove('hidden');
    saveScore(score);
}

// --- БАЗА ДАННЫХ ---
async function saveScore(newScore) {
    if (!db) return;
    const userRef = doc(db, "leaderboard", user.id.toString());
    try {
        const docSnap = await getDoc(userRef);
        let bestScore = 0;
        if (docSnap.exists()) bestScore = docSnap.data().score;

        if (newScore > bestScore) {
            await setDoc(userRef, {
                username: user.first_name,
                avatar: user.photo_url || "",
                score: newScore,
                time: timeElapsed,
                date: Date.now()
            });
        }
    } catch (e) { console.error(e); }
}

async function loadLeaderboard() {
    if (!db) return;
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<li class="loading">Загрузка...</li>';

    try {
        const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        list.innerHTML = '';
        let rank = 1;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement('li');
            li.classList.add('leader-item');
            if (rank === 1) li.classList.add('rank-1');
            
            let rankIcon = rank + '.';
            if (rank === 1) rankIcon = '🥇';
            if (rank === 2) rankIcon = '🥈';
            if (rank === 3) rankIcon = '🥉';

            const avatarSrc = data.avatar || 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

            li.innerHTML = `
                <div style="width:30px; font-weight:bold;">${rankIcon}</div>
                <img src="${avatarSrc}" class="leader-avatar">
                <div class="leader-name">${data.username}</div>
                <div class="leader-score">${data.score}</div>
            `;
            list.appendChild(li);
            rank++;
        });
    } catch (e) { list.innerHTML = '<li>Ошибка загрузки</li>'; }
}
