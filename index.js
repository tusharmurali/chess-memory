let board = null
let $board = $('#myBoard')
let game = new Chess()
let puzzle  = null
let moves  = null
let orientation = null
let counter = undefined

const squareClass = 'square-55d63'

const $memo = $('#memo')
const $giveUp = $('#giveUp')
const $next = $('#next')
const $correct = $('#correct')
const $incorrect = $('#incorrect')
const $pgn = $('#pgn')

function onDragStart (source, piece) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false
    }
}

function onDrop (source, target) {
    const position = game.fen()

    // see if the move is legal
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
    });

    // illegal move
    if (move === null) return 'snapback'

    // incorrect move
    if (source + target !== moves[counter]) {
        // display position after incorrect move
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: game.fen()
        })

        // revert to position before incorrect move
        board.position(position)
        game.load(position)

        showSolution()

        $giveUp.hide()
        $incorrect.show()
        $next.show()

        return 'snapback'
    }

    updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
    if (++counter === moves.length) { // puzzle finished
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: game.fen()
        })
        $giveUp.hide()
        $correct.show()
        $next.show()
        return
    }

    // we make the next move in the puzzle
    const move = game.move(moves[counter++], { sloppy : true })

    // highlight opponent's move
    $board.find('.' + squareClass).removeClass('highlight-black')
    $board.find('.square-' + move.from).addClass('highlight-black')
    $board.find('.square-' + move.to).addClass('highlight-black')

    board.position(game.fen())

    updateStatus()
}

function updateStatus () {
    $pgn.html(game.pgn().split("\n").splice(3))
}

function getPuzzle() {
    $.get('lichess_db_puzzle.csv', csv => {
        const data = csv.split("\n")

        // get random puzzle
        puzzle = data[Math.floor(Math.random() * data.length)].split(",")

        game.load(puzzle[1])
        moves = puzzle[2].split(" ")
        orientation = game.turn() === 'b' ? 'white' : 'black'

        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: puzzle[1]
        })

        // make first move of the puzzle
        const move = game.move(moves[0], { sloppy: true })
        counter = 1

        // highlight opponent's move
        $board.find('.' + squareClass).removeClass('highlight-black')
        $board.find('.square-' + move.from).addClass('highlight-black')
        $board.find('.square-' + move.to).addClass('highlight-black')

        board.position(game.fen())

        updateStatus()
    })

    // queue remove pieces after memorization time
    setTimeout(() => {
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: true,
            position: game.fen(),
            pieceTheme: 'img/chesspieces/blindfold.png'
        })
        $giveUp.show()
    }, 1000 * $memo.val())
}

function showSolution() {
    for (let i = counter; i < moves.length; i++) {
        setTimeout(() => {
            game.move(moves[i], { sloppy : true })
            board.position(game.fen())
            updateStatus()
        }, (i - counter + 1) * 1000)
    }
}

const config = {
    onDragStart,
    onDrop,
    onSnapEnd
}

const memo = localStorage.getItem("memo")
if (memo)
    $memo.val(memo)
else
    $memo.val(3)
$memo.on("input", () => {
    localStorage.setItem("memo", $memo.val())
})

$giveUp.hide()
$giveUp.click(() => {
    board = Chessboard('myBoard', {
        ...config,
        orientation,
        draggable: false,
        position: game.fen()
    })
    showSolution()
    $giveUp.hide()
    $next.show()
})

$next.hide()
$next.click(() => {
    getPuzzle()
    $correct.hide()
    $incorrect.hide()
    $next.hide()
})

$correct.hide()
$incorrect.hide()

getPuzzle()