-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jul 14, 2026 at 07:21 PM
-- Server version: 11.8.8-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u928398901_ayyanar`
--

-- --------------------------------------------------------

--
-- Table structure for table `account_transactions`
--

CREATE TABLE `account_transactions` (
  `id` int(11) NOT NULL,
  `role` enum('Admin','Supervisor','Owner') NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `flow` enum('IN','OUT') NOT NULL,
  `category` varchar(100) NOT NULL,
  `party_name` varchar(150) DEFAULT NULL,
  `payment_method` enum('Cash','Bank') DEFAULT 'Cash',
  `description` text DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `account_transactions`
--

INSERT INTO `account_transactions` (`id`, `role`, `user_id`, `flow`, `category`, `party_name`, `payment_method`, `description`, `amount`, `date`, `created_at`) VALUES
(1, 'Admin', 1, 'OUT', 'Supervisors', 'Sup1', 'Cash', 'site expenses', 1000.00, '2026-07-13', '2026-07-13 09:58:59'),
(2, 'Supervisor', 4, 'IN', 'Admin', 'Sup1', 'Cash', 'site expenses', 1000.00, '2026-07-13', '2026-07-13 09:58:59'),
(3, 'Admin', 1, 'OUT', 'Supervisors', 'Sup2', 'Bank', 'site', 300.00, '2026-07-13', '2026-07-13 09:59:11'),
(4, 'Supervisor', 5, 'IN', 'Admin', 'Sup2', 'Bank', 'site', 300.00, '2026-07-13', '2026-07-13 09:59:11'),
(5, 'Admin', 1, 'OUT', 'Supervisors', 'Sup1', 'Bank', 'Exp', 1000.00, '2026-07-13', '2026-07-13 10:10:05'),
(6, 'Supervisor', 4, 'IN', 'Admin', 'Sup1', 'Bank', 'Exp', 1000.00, '2026-07-13', '2026-07-13 10:10:05'),
(7, 'Supervisor', 5, 'OUT', 'Site Expenses', 'Test2', 'Cash', 'Vendor: Testvendor (Direct)', 100.00, '2026-07-13', '2026-07-13 10:26:41'),
(8, 'Supervisor', 5, 'OUT', 'Site Expenses', 'Test2', 'Cash', 'Vendor: Testvendor (Direct)', 100.00, '2026-07-13', '2026-07-13 10:28:04'),
(9, 'Supervisor', 5, 'OUT', 'Site Expenses', 'Test2', 'Cash', 'Vendor: Testvendor (Direct)', 100.00, '2026-07-13', '2026-07-13 10:31:03');

-- --------------------------------------------------------

--
-- Table structure for table `advance_requests`
--

CREATE TABLE `advance_requests` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `reason` text DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
  `date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `id` int(11) NOT NULL,
  `worker_id` int(11) NOT NULL,
  `site_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `status` enum('Present','Absent') DEFAULT 'Present',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_records`
--

CREATE TABLE `driver_records` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `vehicle_name` varchar(120) NOT NULL,
  `driver_name` varchar(120) NOT NULL,
  `starting_km` decimal(12,2) NOT NULL,
  `ending_km` decimal(12,2) NOT NULL,
  `total_km` decimal(12,2) NOT NULL,
  `distance` varchar(120) DEFAULT NULL,
  `diesel_fare` decimal(12,2) DEFAULT NULL,
  `load_name` varchar(150) DEFAULT NULL,
  `load_type` enum('Rent','Own') DEFAULT 'Own',
  `customer_name` varchar(150) DEFAULT NULL,
  `place` varchar(150) DEFAULT NULL,
  `load_weight` varchar(120) DEFAULT NULL,
  `starting_time` varchar(50) DEFAULT NULL,
  `ending_time` varchar(50) DEFAULT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leads`
--

CREATE TABLE `leads` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `project_needed` text DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `status` enum('Hot Lead','In Discussion','Converted Client') DEFAULT 'Hot Lead',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ledger`
--

CREATE TABLE `ledger` (
  `id` int(11) NOT NULL,
  `site_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `type` enum('CREDIT','DEBIT') NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_mode` enum('Direct','Indirect') DEFAULT 'Direct',
  `is_gst` tinyint(1) DEFAULT 0,
  `image_url` text DEFAULT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ledger`
--

INSERT INTO `ledger` (`id`, `site_id`, `user_id`, `type`, `category`, `description`, `amount`, `payment_mode`, `is_gst`, `image_url`, `date`, `created_at`) VALUES
(16, 2, 5, 'DEBIT', 'Cement, Steel', 'Vendor: Testvendor (Direct)', 100.00, 'Direct', 0, 'https://apkayyanar.nexoraapp.in/images/supervisor/sup2/bill-1783938401718-198871.jpg', '2026-07-13', '2026-07-13 10:26:41'),
(17, 2, 5, 'DEBIT', 'Cement, Steel', 'Vendor: Testvendor (Direct)', 100.00, 'Direct', 0, 'https://apkayyanar.nexoraapp.in/images/supervisor/sup2/bill-1783938484103-640435.jpg', '2026-07-13', '2026-07-13 10:28:04'),
(18, 2, 5, 'DEBIT', 'Cement, Steel', 'Vendor: Testvendor (Direct)', 100.00, 'Direct', 0, 'https://apkayyanar.nexoraapp.in/images/supervisor/sup2/bill-1783938662763-752576.jpg', '2026-07-13', '2026-07-13 10:31:03');

-- --------------------------------------------------------

--
-- Table structure for table `sites`
--

CREATE TABLE `sites` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `supervisor_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(50) DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sites`
--

INSERT INTO `sites` (`id`, `name`, `location`, `supervisor_id`, `created_at`, `status`) VALUES
(1, 'Test', 'madurai', 4, '2026-07-13 09:57:21', 'Active'),
(2, 'Test2', 'madurai ramnad', 5, '2026-07-13 09:58:17', 'Active');

-- --------------------------------------------------------

--
-- Table structure for table `site_allocations`
--

CREATE TABLE `site_allocations` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `site_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_photos`
--

CREATE TABLE `site_photos` (
  `id` int(11) NOT NULL,
  `site_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `image_url` text NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `location_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `supervisor_attendance`
--

CREATE TABLE `supervisor_attendance` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `site_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `status` enum('Present','Absent') DEFAULT 'Present',
  `selfie_url` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `location_name` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('Admin','Supervisor','Driver','Accounts','Owner','TotalAccounts') NOT NULL,
  `phone` varchar(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `name`, `role`, `phone`, `password`, `created_at`) VALUES
(1, 'admin', 'System Administrator', 'Admin', '0000000000', 'admin123', '2026-07-13 09:46:02'),
(2, 'acc', 'Accounts', 'Accounts', '999999999', '12345678', '2026-07-13 09:50:08'),
(3, 'owner', 'Owner', 'Owner', '9999999999', '12345678', '2026-07-13 09:53:47'),
(4, 'sup1', 'Sup1', 'Supervisor', '999999999', '12345678', '2026-07-13 09:54:05'),
(5, 'sup2', 'Sup2', 'Supervisor', '99999999', '12345678', '2026-07-13 09:54:21'),
(6, 'dr1', 'Driver1', 'Driver', '999999999', '12345678', '2026-07-13 09:54:34'),
(7, 'totalaccc', 'Totalacc', 'TotalAccounts', '999999999', '12345678', '2026-07-13 09:54:53'),
(8, 'totacc', 'Total Accounts', 'TotalAccounts', '0000000002', 'totacc123', '2026-07-13 09:56:15');

-- --------------------------------------------------------

--
-- Table structure for table `workers`
--

CREATE TABLE `workers` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `account_transactions`
--
ALTER TABLE `account_transactions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `advance_requests`
--
ALTER TABLE `advance_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `worker_id` (`worker_id`),
  ADD KEY `site_id` (`site_id`);

--
-- Indexes for table `driver_records`
--
ALTER TABLE `driver_records`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ledger`
--
ALTER TABLE `ledger`
  ADD PRIMARY KEY (`id`),
  ADD KEY `site_id` (`site_id`);

--
-- Indexes for table `sites`
--
ALTER TABLE `sites`
  ADD PRIMARY KEY (`id`),
  ADD KEY `supervisor_id` (`supervisor_id`);

--
-- Indexes for table `site_allocations`
--
ALTER TABLE `site_allocations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`,`site_id`),
  ADD KEY `site_id` (`site_id`);

--
-- Indexes for table `site_photos`
--
ALTER TABLE `site_photos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `site_id` (`site_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `supervisor_attendance`
--
ALTER TABLE `supervisor_attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`,`site_id`,`date`),
  ADD KEY `site_id` (`site_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `workers`
--
ALTER TABLE `workers`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `account_transactions`
--
ALTER TABLE `account_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `advance_requests`
--
ALTER TABLE `advance_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `attendance`
--
ALTER TABLE `attendance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `driver_records`
--
ALTER TABLE `driver_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leads`
--
ALTER TABLE `leads`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ledger`
--
ALTER TABLE `ledger`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `sites`
--
ALTER TABLE `sites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `site_allocations`
--
ALTER TABLE `site_allocations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `site_photos`
--
ALTER TABLE `site_photos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `supervisor_attendance`
--
ALTER TABLE `supervisor_attendance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `workers`
--
ALTER TABLE `workers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `advance_requests`
--
ALTER TABLE `advance_requests`
  ADD CONSTRAINT `advance_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `sites` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `ledger`
--
ALTER TABLE `ledger`
  ADD CONSTRAINT `ledger_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sites`
--
ALTER TABLE `sites`
  ADD CONSTRAINT `sites_ibfk_1` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `site_allocations`
--
ALTER TABLE `site_allocations`
  ADD CONSTRAINT `site_allocations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `site_allocations_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `sites` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `site_photos`
--
ALTER TABLE `site_photos`
  ADD CONSTRAINT `site_photos_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `site_photos_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `supervisor_attendance`
--
ALTER TABLE `supervisor_attendance`
  ADD CONSTRAINT `supervisor_attendance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `supervisor_attendance_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `sites` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
