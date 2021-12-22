let board = null
let $board = $('#myBoard')
let game = new Chess()
let puzzle  = null
let moves  = null
let orientation = null
let counter = undefined
let puzzleHistory = []

const squareClass = 'square-55d63'

const $countdownContainer = $('#countdownContainer')
$countdownContainer.hide()
const $countdown = $('#countdown')
const $loading = $('#loading')
const $history = $('#history')
const $memo = $('#memo')
const $theme = $('#theme')
const $giveUp = $('#giveUp')
const $next = $('#next')
const $correct = $('#correct')
const $incorrect = $('#incorrect')
const $pgn = $('#pgn')

function onDragStart(source, piece) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false
    }
}

function onDrop(source, target) {
    const position = game.fen()

    // see if the move is legal
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
    })

    // illegal move
    if (move === null) return 'snapback'

    // incorrect move
    if (!moves[counter].includes(source + target) && !game.in_checkmate()) {
        const movesToNow = game.pgn().split("\n").splice(3)[0]

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

        showSolution(movesToNow)

        $giveUp.hide()
        $incorrect.show()
        $next.show()

        updateHistory("0")

        return 'snapback'
    }

    updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
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

        updateHistory("1")
        return
    }

    // make the next move in the puzzle
    const move = game.move(moves[counter++], { sloppy : true })

    highlightMove(move)
    board.position(game.fen())

    updateStatus()
}

function updateStatus(prefix) {
    if (prefix) {
        let status = game.pgn().split("\n").splice(3)[0]
        const dots = status.indexOf("...")
        if (dots !== -1) status = status.substring(dots + 4)
        $pgn.html(prefix + " " + status)
    } else {
        $pgn.html(game.pgn().split("\n").splice(3)[0])
    }
}

function updateHistory(number) {
    if (number) {
        if (puzzleHistory.length > 9) {
            puzzleHistory.shift()
            puzzleHistory.push(number)
        } else {
            puzzleHistory.push(number)
        }
        localStorage.setItem("history", puzzleHistory)
    }
    $history.empty()
    for (let i = 0; i < puzzleHistory.length; i++) {
        if (puzzleHistory[i] === "0")
            $history.append('<span class="badge bg-danger mx-1"><i class="bi bi-x"></i></span>')
        else
            $history.append('<span class="badge bg-success mx-1"><i class="bi bi-check"></i></span>')
    }
}

function getPuzzle() {
    $.get('lichess_db_puzzle.csv', csv => {
        const data = csv.split("\n")

        // get random puzzle
        puzzle = data[Math.floor(Math.random() * data.length)].split(",")

        game.load(puzzle[1])
        moves = puzzle[2].split(" ")
        orientation = game.turn() === 'b' ? 'white' : 'black'

        $loading.hide()
        $history.show()

        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: puzzle[1]
        })

        // make first move of the puzzle
        const move = game.move(moves[0], { sloppy: true })
        counter = 1

        highlightMove(move)
        board.position(game.fen())

        updateStatus()
    }).then(() => {
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

        $countdownContainer.show()

        let countdown = $memo.val()
        $countdown.html(countdown)
        const interval = setInterval(() => {
            if (countdown == 1) {
                $countdownContainer.hide()
                clearInterval(interval)
            }
            $countdown.html(--countdown)
        }, 1000)
    })
}

let timeouts = []

function showSolution(movesToNow) {
    if (movesToNow) {
        movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(" "))
        if (movesToNow.endsWith(".")) movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(" "))
    }
    for (let i = counter; i < moves.length; i++) {
        timeouts[i] = setTimeout(() => {
            game.move(moves[i], { sloppy : true })
            board.position(game.fen())
            updateStatus(movesToNow)
        }, (i - counter + 1) * 1000)
    }
}

function clearTimeouts() {
    for (let i = counter; i < timeouts.length; i++)
        clearTimeout(timeouts[i])
}

function highlightMove(move) {
    $board.find('.' + squareClass).removeClass('highlight-black')
    $board.find('.square-' + move.from).addClass('highlight-black')
    $board.find('.square-' + move.to).addClass('highlight-black')
}

const config = {
    onDragStart,
    onDrop,
    onSnapEnd,
}

const memo = localStorage.getItem("memo")
if (memo)
    $memo.val(memo)
else
    $memo.val(5)
$memo.on("input", () => {
    localStorage.setItem("memo", $memo.val())
})

const theme = localStorage.getItem("theme")
if (theme) {
    $theme.val(theme)
    config.pieceTheme = `img/chesspieces/${theme}/{piece}.png`
} else {
    $theme.val("wikipedia")
    config.pieceTheme = `img/chesspieces/wikipedia/{piece}.png`
}
$theme.on("change", () => {
    config.pieceTheme = `img/chesspieces/${$theme.val()}/{piece}.png`
    if ($giveUp.is(":hidden") || $next.is(":visible")) {
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: board.fen(),
            pieceTheme: `img/chesspieces/${$theme.val()}/{piece}.png`
        })
    }
    localStorage.setItem("theme", $theme.val())
})

$history.hide()
const history = localStorage.getItem("history")
if (history) {
    puzzleHistory = history.split(",")
    updateHistory()
}

$giveUp.hide()
$giveUp.click(() => {
    board = Chessboard('myBoard', {
        ...config,
        orientation,
        draggable: false,
        position: game.fen()
    })
    updateHistory("0")
    showSolution()
    $giveUp.hide()
    $next.show()
})

$next.hide()
$next.click(() => {
    clearTimeouts()
    getPuzzle()
    $correct.hide()
    $incorrect.hide()
    $next.hide()
})

$correct.hide()
$incorrect.hide()

getPuzzle()