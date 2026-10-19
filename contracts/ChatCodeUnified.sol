// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChatCodeUnified
 * @dev Unified Smart Contract for ChatCode:
 *      1. Chat Code Channel Registry (associates chat codes with counterparties & metadata)
 *      2. On-Chain Verified Attestations & Peer Reputation (1-5 star reviews tied to chat codes)
 *      3. P2P Escrow & Milestone Settlement (deposit, release upon sign-off, dispute/refund)
 *
 * Designed for deployment on Robinhood Chain Testnet (Chain ID: 46630) via Remix IDE.
 * Fully self-contained with no external library dependencies.
 */
contract ChatCodeUnified {
    // --- Custom Errors ---
    error InvalidRating();
    error EmptyChatCode();
    error EmptyText();
    error ChannelAlreadyExists();
    error ChannelDoesNotExist();
    error Unauthorized();
    error EscrowAlreadyDeposited();
    error EscrowNotDeposited();
    error EscrowAlreadyReleased();
    error TransferFailed();
    error ReentrancyGuardTriggered();

    // --- Enums ---
    enum ChannelStatus { Active, Completed, Disputed, Closed }
    enum EscrowStatus { None, Funded, Released, Refunded }

    // --- Structs ---
    struct Review {
        uint256 id;
        string chatCode;
        address reviewer;
        address peer;
        uint8 score;          // 1 to 5
        string category;      // e.g. "delivery", "quality", "service", "communication"
        string text;          // Review comment or verification attestation
        uint256 timestamp;
        uint256 blockNumber;
    }

    struct Channel {
        string chatCode;
        address initiator;
        address counterparty;
        ChannelStatus status;
        uint256 createdAt;
        uint256 escrowAmount;
        EscrowStatus escrowStatus;
        string metadataURI;   // Optional IPFS/Hash reference
    }

    struct PeerReputation {
        uint256 totalReviews;
        uint256 totalScore;       // Sum of all scores
        uint256 fiveStarCount;
        uint256 fourStarCount;
        uint256 threeStarCount;
        uint256 lowStarCount;     // 1 and 2 stars
    }

    // --- State Variables ---
    address public owner;
    uint256 public totalReviewsCount;
    uint256 public totalChannelsCount;
    uint256 private _reentrancyStatus;

    // Mappings
    mapping(string => Channel) public channels;
    mapping(string => bool) public channelExists;
    mapping(string => Review[]) private _channelReviews;
    mapping(address => Review[]) private _peerReceivedReviews;
    mapping(address => PeerReputation) public peerReputations;

    // Global review list by ID
    mapping(uint256 => Review) public allReviews;

    // --- Events ---
    event ChannelCreated(
        string indexed chatCode,
        address indexed initiator,
        address indexed counterparty,
        uint256 createdAt
    );

    event ReviewSubmitted(
        uint256 indexed reviewId,
        string indexed chatCode,
        address indexed reviewer,
        address peer,
        uint8 score,
        string category,
        string text,
        uint256 timestamp,
        uint256 blockNumber
    );

    event EscrowDeposited(
        string indexed chatCode,
        address indexed depositor,
        address indexed recipient,
        uint256 amount
    );

    event EscrowReleased(
        string indexed chatCode,
        address indexed recipient,
        uint256 amount
    );

    event EscrowRefunded(
        string indexed chatCode,
        address indexed depositor,
        uint256 amount
    );

    event ChannelStatusUpdated(
        string indexed chatCode,
        ChannelStatus newStatus
    );

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == 2) revert ReentrancyGuardTriggered();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    constructor() {
        owner = msg.sender;
        _reentrancyStatus = 1;
    }

    // ========================================================
    // 1. CHAT CODE CHANNEL REGISTRY
    // ========================================================

    /**
     * @notice Registers or opens a new ChatCode channel between initiator and counterparty.
     * @param chatCode The unique normalized chat code (e.g. "ORDER-1042").
     * @param counterparty The counterparty wallet address (or address(0) for open channel).
     * @param metadataURI Optional metadata reference or order description.
     */
    function createChannel(
        string calldata chatCode,
        address counterparty,
        string calldata metadataURI
    ) external returns (bool) {
        if (bytes(chatCode).length == 0) revert EmptyChatCode();
        if (channelExists[chatCode]) revert ChannelAlreadyExists();

        channelExists[chatCode] = true;
        channels[chatCode] = Channel({
            chatCode: chatCode,
            initiator: msg.sender,
            counterparty: counterparty,
            status: ChannelStatus.Active,
            createdAt: block.timestamp,
            escrowAmount: 0,
            escrowStatus: EscrowStatus.None,
            metadataURI: metadataURI
        });

        totalChannelsCount++;

        emit ChannelCreated(chatCode, msg.sender, counterparty, block.timestamp);
        return true;
    }

    /**
     * @notice Updates channel status (e.g. Completed, Closed, Disputed).
     */
    function updateChannelStatus(
        string calldata chatCode,
        ChannelStatus newStatus
    ) external {
        if (!channelExists[chatCode]) revert ChannelDoesNotExist();
        Channel storage ch = channels[chatCode];
        if (msg.sender != ch.initiator && msg.sender != ch.counterparty && msg.sender != owner) {
            revert Unauthorized();
        }

        ch.status = newStatus;
        emit ChannelStatusUpdated(chatCode, newStatus);
    }

    // ========================================================
    // 2. ON-CHAIN REPUTATION & REVIEWS
    // ========================================================

    /**
     * @notice Submits an immutable cryptographic review under a chat code.
     * @param chatCode The target chat code (e.g. "ORDER-1042").
     * @param peer The counterparty wallet address being reviewed.
     * @param score Rating score from 1 to 5 stars.
     * @param category Category identifier (e.g. "delivery", "quality", "service").
     * @param reviewText Public review attestation message.
     */
    function submitReview(
        string calldata chatCode,
        address peer,
        uint8 score,
        string calldata category,
        string calldata reviewText
    ) external returns (uint256) {
        if (bytes(chatCode).length == 0) revert EmptyChatCode();
        if (score < 1 || score > 5) revert InvalidRating();
        if (bytes(reviewText).length == 0) revert EmptyText();

        // If channel does not exist, auto-register it
        if (!channelExists[chatCode]) {
            channelExists[chatCode] = true;
            channels[chatCode] = Channel({
                chatCode: chatCode,
                initiator: msg.sender,
                counterparty: peer,
                status: ChannelStatus.Active,
                createdAt: block.timestamp,
                escrowAmount: 0,
                escrowStatus: EscrowStatus.None,
                metadataURI: ""
            });
            totalChannelsCount++;
            emit ChannelCreated(chatCode, msg.sender, peer, block.timestamp);
        }

        totalReviewsCount++;
        uint256 newId = totalReviewsCount;

        Review memory r = Review({
            id: newId,
            chatCode: chatCode,
            reviewer: msg.sender,
            peer: peer,
            score: score,
            category: category,
            text: reviewText,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        allReviews[newId] = r;
        _channelReviews[chatCode].push(r);

        if (peer != address(0)) {
            _peerReceivedReviews[peer].push(r);

            // Update peer reputation counters
            PeerReputation storage rep = peerReputations[peer];
            rep.totalReviews++;
            rep.totalScore += score;
            if (score == 5) rep.fiveStarCount++;
            else if (score == 4) rep.fourStarCount++;
            else if (score == 3) rep.threeStarCount++;
            else rep.lowStarCount++;
        }

        emit ReviewSubmitted(
            newId,
            chatCode,
            msg.sender,
            peer,
            score,
            category,
            reviewText,
            block.timestamp,
            block.number
        );

        return newId;
    }

    // ========================================================
    // 3. P2P ESCROW & MILESTONE SETTLEMENT
    // ========================================================

    /**
     * @notice Deposit native ETH into escrow under a specific chat code.
     * @param chatCode The chat code associated with the transaction/order.
     * @param recipient The intended recipient of the escrow funds.
     */
    function depositEscrow(
        string calldata chatCode,
        address recipient
    ) external payable nonReentrant {
        if (msg.value == 0) revert EmptyText();
        if (bytes(chatCode).length == 0) revert EmptyChatCode();

        if (!channelExists[chatCode]) {
            channelExists[chatCode] = true;
            channels[chatCode] = Channel({
                chatCode: chatCode,
                initiator: msg.sender,
                counterparty: recipient,
                status: ChannelStatus.Active,
                createdAt: block.timestamp,
                escrowAmount: msg.value,
                escrowStatus: EscrowStatus.Funded,
                metadataURI: ""
            });
            totalChannelsCount++;
            emit ChannelCreated(chatCode, msg.sender, recipient, block.timestamp);
        } else {
            Channel storage ch = channels[chatCode];
            if (ch.escrowStatus == EscrowStatus.Funded) revert EscrowAlreadyDeposited();
            ch.escrowAmount = msg.value;
            ch.escrowStatus = EscrowStatus.Funded;
            if (ch.counterparty == address(0)) {
                ch.counterparty = recipient;
            }
        }

        emit EscrowDeposited(chatCode, msg.sender, recipient, msg.value);
    }

    /**
     * @notice Release deposited escrow funds to the counterparty.
     * @param chatCode The chat code for the escrowed order.
     */
    function releaseEscrow(string calldata chatCode) external nonReentrant {
        if (!channelExists[chatCode]) revert ChannelDoesNotExist();
        Channel storage ch = channels[chatCode];

        if (ch.escrowStatus != EscrowStatus.Funded) revert EscrowNotDeposited();
        if (msg.sender != ch.initiator && msg.sender != owner) revert Unauthorized();

        uint256 payout = ch.escrowAmount;
        address recipient = ch.counterparty;
        ch.escrowAmount = 0;
        ch.escrowStatus = EscrowStatus.Released;
        ch.status = ChannelStatus.Completed;

        (bool success, ) = payable(recipient).call{value: payout}("");
        if (!success) revert TransferFailed();

        emit EscrowReleased(chatCode, recipient, payout);
    }

    /**
     * @notice Refund escrow funds back to depositor (by agreement or admin).
     */
    function refundEscrow(string calldata chatCode) external nonReentrant {
        if (!channelExists[chatCode]) revert ChannelDoesNotExist();
        Channel storage ch = channels[chatCode];

        if (ch.escrowStatus != EscrowStatus.Funded) revert EscrowNotDeposited();
        if (msg.sender != ch.counterparty && msg.sender != owner) revert Unauthorized();

        uint256 refundAmount = ch.escrowAmount;
        address depositor = ch.initiator;
        ch.escrowAmount = 0;
        ch.escrowStatus = EscrowStatus.Refunded;
        ch.status = ChannelStatus.Closed;

        (bool success, ) = payable(depositor).call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit EscrowRefunded(chatCode, depositor, refundAmount);
    }

    // ========================================================
    // 4. VIEW & QUERY FUNCTIONS
    // ========================================================

    /**
     * @notice Returns all on-chain reviews for a given chat code.
     */
    function getReviewsByChatCode(
        string calldata chatCode
    ) external view returns (Review[] memory) {
        return _channelReviews[chatCode];
    }

    /**
     * @notice Returns all on-chain reviews received by a peer.
     */
    function getReviewsForPeer(
        address peer
    ) external view returns (Review[] memory) {
        return _peerReceivedReviews[peer];
    }

    /**
     * @notice Computes average rating for a peer scaled by 100 (e.g. 485 = 4.85 stars).
     */
    function getPeerAverageRating(
        address peer
    ) external view returns (uint256 averageScoreScaled, uint256 count) {
        PeerReputation memory rep = peerReputations[peer];
        if (rep.totalReviews == 0) return (0, 0);
        return ((rep.totalScore * 100) / rep.totalReviews, rep.totalReviews);
    }

    /**
     * @notice Channel lookup helper.
     */
    function getChannel(
        string calldata chatCode
    ) external view returns (Channel memory) {
        return channels[chatCode];
    }
}
