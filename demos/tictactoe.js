const kCellWidth = 200;
const kCellHeight = 200;
const kAccessibleInset = 12;

var board = [];
var axCells = [];

var player = 'x';

function $(id) {
    return document.getElementById(id);
}

function other(player) {
    return player == 'x' ? 'o' : 'x';
}

function winner() {
    for (var i = 0; i < 3; i++) {
        if (board[i][0] &&
            board[i][0] == board[i][1] &&
            board[i][0] == board[i][2]) {
            return board[i][0];
        }
        if (board[0][i] &&
            board[0][i] == board[1][i] &&
            board[0][i] == board[2][i]) {
            return board[0][i];
        }
    }
    if (board[0][0] &&
        board[0][0] == board[1][1] &&
        board[0][0] == board[2][2]) {
        return board[0][0];
    }
    if (board[0][2] &&
        board[0][2] == board[1][1] &&
        board[0][2] == board[2][0]) {
        return board[0][2];
    }
    return '';
}

function init() {
    var aomEnabled = (document.body.accessibleNode != undefined);
    var nodes = document.querySelectorAll(".aom_enabled");
    for (var i = 0; i < nodes.length; i++)
        nodes[i].style.display = aomEnabled ? "block" : "none";
    nodes = document.querySelectorAll(".aom_disabled");
    for (var i = 0; i < nodes.length; i++)
        nodes[i].style.display = aomEnabled ? "none" : "block";

    for (var j = 0; j < 3; j++) {
        board.push(['', '', '']);
        axCells.push([null, null, null]);
    }

    var canvas = $('board');
    var axBoard = canvas.accessibleNode;
    axBoard.role = 'region';
    for (var j = 0; j < 3; j++) {
        var axRow = new AccessibleNode();
        axRow.role = 'region';;
        axBoard.appendChild(axRow);
        for (var i = 0; i < 3; i++) {
            var axCell = new AccessibleNode();
            axCell.role = 'button';
            axCell.label = 'Cell ' + (i + 1) + ', ' + (j + 1);
            axCell.offsetLeft = i * kCellWidth + kAccessibleInset;
            axCell.offsetTop = j * kCellHeight + kAccessibleInset;
            axCell.offsetWidth = kCellWidth - 2 * kAccessibleInset;
            axCell.offsetHeight = kCellHeight - 2 * kAccessibleInset;
            axCell.offsetParent = axBoard;
            axCell.addEventListener('accessibleclick', (function(i, j) {
                click(i, j);
            }).bind(this, i, j));
            axRow.appendChild(axCell);
            axCells[i][j] = axCell;
        }
    }
}

function drawX(context) {
    context.beginPath();
    context.strokeStyle = '#000099';
    context.lineWidth = 0.05;
    context.moveTo(0.25, 0.25);
    context.lineTo(0.75, 0.75);
    context.moveTo(0.75, 0.25);
    context.lineTo(0.25, 0.75);
    context.stroke();
}

function drawO(context) {
    context.beginPath();
    context.strokeStyle = '#000099';
    context.lineWidth = 0.05;
    context.beginPath();
    context.ellipse(0.5, 0.5, 0.25, 0.25, 0, 0, 2 * Math.PI, true);
    context.stroke()
}

function drawBoard() {
    var canvas = $('board');
    var context = canvas.getContext('2d');
    context.globalAlpha = 1.0;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    context.save();
    context.scale(kCellWidth, kCellHeight);

    for (var i = 0; i < 2; i++) {
        context.beginPath();
        context.strokeStyle = '#9999dd';
        context.lineWidth = 0.02;
        context.moveTo(0, i + 1);
        context.lineTo(3, i + 1);
        context.moveTo(i + 1, 0);
        context.lineTo(i + 1, 3);
        context.stroke();
    }

    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            context.save();
            context.translate(i, j);
            switch (board[i][j]) {
            case 'x':
                drawX(context);
                break;
            case 'o':
                drawO(context);
                break;
            }
            context.restore();
        }
    }
    context.restore();
}

function message(str) {
    var m = document.createElement('p');
    m.textContent = str;
    $('status').appendChild(m);
}

function update(i, j) {
    m = '';
    if (i !== undefined && j !== undefined) {
        m = other(player) + ' plays ' + (i + 1) + ', ' + (j + 1) + '. ';
    }

    if (winner()) {
        m += winner() + ' is the winner';
    } else {
        m += 'It\'s ' + player + '\'s turn';
    }

    message(m);
    drawBoard();
}

function computerMove() {
    do {
        var i = Math.floor(Math.random() * 3);
        var j = Math.floor(Math.random() * 3);
    } while (board[i][j]);
    board[i][j] = player;
    axCells[i][j].disabled = true;
    axCells[i][j].label = player + ', ' + axCells[i][j].label;
    player = other(player);

    update(i, j);
}

function click(i, j) {
    console.log('Click ' + i + ', ' + j);
    if (board[i][j] || player != 'x')
      return;
    board[i][j] = player;
    axCells[i][j].disabled = true;
    axCells[i][j].label = player + ', ' + axCells[i][j].label;
    player = other(player);

    update(i, j);

    if (player == 'o' && !winner())
        setTimeout(computerMove, 2000);
}

init();

drawBoard();

window.setTimeout(function() {
    update();
}, 2000);
