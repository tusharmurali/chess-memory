let board = null
let $board = $('#myBoard')
let game = new Chess()
let puzzle  = null
let moves  = null
let orientation = null
// counter for current index in the puzzle solution
let counter = undefined
let promoting = false
let promotingTo = 'q'
let history = []

const moveSound = new Audio('move.mp3')
const captureSound = new Audio('capture.mp3')
const squareClass = 'square-55d63'
const whiteSquareGrey = '#a9a9a9'
const blackSquareGrey = '#696969'

const $countdownContainer = $('#countdownContainer')
$countdownContainer.hide()
const $countdown = $('#countdown')
const $loading = $('#loading')
const $loadingText = $('#loadingText')
const $promotionDialog = $('#promotion-dialog')
$promotionDialog.hide()
const $memo = $('#memo')
const $theme = $('#theme')
const $rating = $('#rating')
const $easyMode = $('#easyMode')
const $again = $('#again')
const $giveUp = $('#giveUp')
const $retry = $('#retry')
const $next = $('#next')
const $left = $('#left')
const $right = $('#right')
const $correct = $('#correct')
const $incorrect = $('#incorrect')
const $pgn = $('#pgn')
const getImgSrc = piece => `img/chesspieces/${$theme.val()}/{piece}.png`.replace('{piece}', game.turn() + piece.toLocaleUpperCase())

// Functions for Easy Mode

function removeGreySquares () {
    $('#myBoard .square-55d63').css('background', '')
}

function greySquare(square) {
    let $square = $('#myBoard .square-' + square)

    let background = whiteSquareGrey
    if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey
    }

    $square.css('background', background)
}

// Handle mouse events with chessboard.js

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
    removeGreySquares()

    const position = game.fen()
    const piece = game.get(source).type

    // see if the move is legal
    let move = game.move({
        from: source,
        to: target,
        promotion: promotingTo
    })

    // illegal move
    if (move === null) return 'snapback'

    $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'pointer')
    const sourceRank = source.charAt(1)
    const targetRank = target.charAt(1)

    if (!promoting && piece === 'p'
        && ((sourceRank === '7' && targetRank === '8') || (sourceRank === '2' && targetRank === '1'))) {
        // undo the last move to allow for piece selection
        game.undo()

        // set the color of pieces in the modal
        $('.promotion-piece-q').attr('src', getImgSrc('q'))
        $('.promotion-piece-r').attr('src', getImgSrc('r'))
        $('.promotion-piece-n').attr('src', getImgSrc('n'))
        $('.promotion-piece-b').attr('src', getImgSrc('b'))
        $promotionDialog.attr('data-source', source)
        $promotionDialog.attr('data-target', target)
        $promotionDialog.show()
        $promotionDialog.position({ of: $board, my: 'center center', at: 'center center' })
        $board.css('pointer-events', 'none')

        promoting = true

        return 'snapback'
    }

    if (move.captured) captureSound.play()
    else moveSound.play()

    // incorrect move
    if ((!moves[counter].includes(source + target) && !game.in_checkmate()) || (promoting && !moves[counter].endsWith(promotingTo))) {
        const movesToNow = game.pgn().split('\n').splice(3)[0]

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

        // update interface
        $again.hide()
        $giveUp.hide()
        $incorrect.show()
        $retry.show()
        $easyMode.attr('disabled', false)
        $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'auto')
        $next.show()
        $left.css('visibility', 'visible')
        $right.css('visibility', 'visible')

        return 'snapback'
    }

    if (move.promotion) onSnapEnd()

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
        // update interface
        $again.hide()
        $giveUp.hide()
        $correct.show()
        $retry.show()
        $easyMode.attr('disabled', false)
        $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'auto')
        $next.show()
        $left.css('visibility', 'visible')
        $right.css('visibility', 'visible')

        return
    }

    // make the next move in the puzzle
    const move = game.move(moves[counter++], { sloppy : true })
    if (move.captured) captureSound.play()
    else moveSound.play()

    highlightMove(move)
    board.position(game.fen())
    $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'pointer')

    updateStatus()
}

function onMouseoverSquare (square) {
    if ($easyMode.is(':checked') && $giveUp.is(':visible')) {
        // get list of possible moves for this square
        let moves = game.moves({
            square: square,
            verbose: true
        })

        // exit if there are no moves available for this square
        if (moves.length === 0) return

        // highlight the square they moused over
        greySquare(square)

        // highlight the possible squares for this piece
        for (let i = 0; i < moves.length; i++) {
            greySquare(moves[i].to)
        }
    }
}

// Functions for notation below the chess board

function getStatus(prefix) {
    if (prefix) {
        let status = game.pgn().split('\n').splice(3)[0]
        const dots = status.indexOf('...')
        if (dots !== -1) status = status.substring(dots + 4)
        return prefix + ' ' + status
    } else {
        return game.pgn().split('\n').splice(3)[0]
    }
}

function updateStatus(prefix) {
    if (prefix) {
        let status = game.pgn().split('\n').splice(3)[0]
        const dots = status.indexOf('...')
        if (dots !== -1) status = status.substring(dots + 4)
        $pgn.html(prefix + ' ' + status)
    } else {
        $pgn.html(game.pgn().split('\n').splice(3)[0])
    }
}

/**
 * Generate a new puzzle
 * @param {string} [p] - puzzle ID, if already known
 */

function getPuzzle(p) {
    $.get('lichess_db_puzzle/' + $rating.val() + '.csv', csv => {
        const data = csv.split('\n')

        // get random puzzle or p, if already known
        puzzle = p ?? data[Math.floor(Math.random() * data.length)].split(',')

        game.load(puzzle[1])
        moves = puzzle[2].split(' ')
        orientation = game.turn() === 'b' ? 'white' : 'black'

        $loading.hide()
        $loadingText.hide()

        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: puzzle[1]
        })

        // make first move of the puzzle
        const move = game.move(moves[0], { sloppy: true })
        if (move.captured) captureSound.play()
        else moveSound.play()
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
            $(`img[data-piece^=${game.turn()}]`).css('cursor', 'pointer')
            $easyMode.attr('disabled', true)
            $again.show()
            $giveUp.show()
        }, 1000 * $memo.val())

        $countdownContainer.show()

        // start countdown
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

// Functions for showing sequence of moves in puzzle solution

let timeouts = []

function showSolution(movesToNow) {
    if (movesToNow) {
        movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(' '))
        if (movesToNow.endsWith('.')) movesToNow = movesToNow.substring(0, movesToNow.lastIndexOf(' '))
    }
    for (let i = counter; i < moves.length; i++) {
        timeouts[i] = setTimeout(() => {
            const move = game.move(moves[i], { sloppy : true })
            board.position(game.fen())
            if (move.captured) captureSound.play()
            else moveSound.play()
            updateStatus(movesToNow)
        }, (i - counter + 1) * 1000)
    }
    timeouts.push(setTimeout(() => {
        $left.css('visibility', 'visible')
        $right.css('visibility', 'visible')
    }, (moves.length - counter) * 1000))
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

// Configuration for Chessboard

const config = {
    onDragStart,
    onDrop,
    onSnapEnd,
    onMouseoutSquare: removeGreySquares,
    onMouseoverSquare
}

// Prevent page scrolling when dragging pieces on mobile

$board.on('scroll touchmove touchend touchstart contextmenu', event => event.preventDefault())

// Persist memorization time by binding to local storage

const memo = localStorage.getItem('memo')
if (memo)
    $memo.val(memo)
else
    $memo.val(5)
$memo.on('input', () => {
    localStorage.setItem('memo', $memo.val())
})

$('#promote-to li').click(function() {
    $promotionDialog.hide()
    promotingTo = $(this).find('span').text()
    $board.css('pointer-events', 'auto')
    onDrop($promotionDialog.attr('data-source'),$promotionDialog.attr('data-target'))
    promoting = false
})

// Set initial piece theme, and persist by binding to local storage

const theme = localStorage.getItem('theme')
if (theme) {
    $theme.val(theme)
    config.pieceTheme = `img/chesspieces/${theme}/{piece}.png`
} else {
    $theme.val('wikipedia')
    config.pieceTheme = `img/chesspieces/wikipedia/{piece}.png`
}
$theme.on('change', () => {
    config.pieceTheme = `img/chesspieces/${$theme.val()}/{piece}.png`
    if ($giveUp.is(':hidden') || $next.is(':visible')) {
        board = Chessboard('myBoard', {
            ...config,
            orientation,
            draggable: false,
            position: board.fen(),
            pieceTheme: `img/chesspieces/${$theme.val()}/{piece}.png`
        })
    }
    $('.promotion-piece-q').attr('src', getImgSrc('q'))
    $('.promotion-piece-r').attr('src', getImgSrc('r'))
    $('.promotion-piece-n').attr('src', getImgSrc('n'))
    $('.promotion-piece-b').attr('src', getImgSrc('b'))
    localStorage.setItem('theme', $theme.val())
})

// Persist puzzle rating by binding to local storage

const rating = localStorage.getItem('rating')
if (rating) {
    $rating.val(rating)
} else {
    $rating.val('1400-1599')
}
$rating.on('change', () => {
    localStorage.setItem('rating', $rating.val())
})

// Button Functionality

$again.hide()
$again.click(() => {
    // marker
    clearTimeouts()
    getPuzzle(puzzle)
    $again.hide()
    $giveUp.hide()
    $correct.hide()
    $incorrect.hide()
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
    $again.hide()
    $giveUp.hide()
    $retry.show()
    $easyMode.attr('disabled', false)
    $(`img[data-piece^=${orientation.charAt(0)}]`).css('cursor', 'auto')
    $next.show()
})

$retry.hide()
$retry.click(() => {
    clearTimeouts()
    getPuzzle(puzzle)
    $correct.hide()
    $incorrect.hide()
    $retry.hide()
    $next.hide()
    $left.css('visibility', 'hidden')
    $right.css('visibility', 'hidden')
})

$next.hide()
$next.click(() => {
    clearTimeouts()
    getPuzzle()
    $correct.hide()
    $incorrect.hide()
    $retry.hide()
    $next.hide()
    $left.css('visibility', 'hidden')
    $right.css('visibility', 'hidden')
})

$left.css('visibility', 'hidden')
$right.css('visibility', 'hidden')

// Hide info display

$correct.hide()
$incorrect.hide()

// Allow toggling back and forth between moves after puzzle ended using arrow keys

$(document).keydown(function (e) {
    const move = game.undo()
    game.move(move)

    if (history.length === 0 && (!move || move.from + move.to + (move.promotion ?? '') !== moves[moves.length - 1])) return

    if (e.keyCode === 37) {
        console.log(game.pgn())
        const m1 = game.undo()
        const m2 = game.undo()
        console.log(m1, m2)
        if (!m2) {
            game.move(m1)
            return
        }
        console.log('here')
        game.move(m2)
        history.push(m1)
        board.position(game.fen())
    } else if (e.keyCode === 39) {
        game.move(history.pop())
        board.position(game.fen())
    } else {
        return
    }
    let html = $pgn.html().replaceAll('<strong>', '')
    html = html.replaceAll('</strong>', '')
    const end = html.split(getStatus())[1] ?? ''
    const start = html.slice(0, -end.length)
    const past = start.split(' ')
    const bold = past[past.length - 1]
    if (bold.trim().length === 0) {
        let all = html.split(' ')
        const last = all.pop()
        $pgn.html(all.join(' ') + ' <strong>' + last + '</strong>')
        return
    }
    $pgn.html(start.slice(0, -bold.length) + '<strong>' + bold + '</strong>' + end)
})

// Initial call

getPuzzle()