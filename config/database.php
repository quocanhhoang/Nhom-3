<?php
    $host = "localhost";
    $port = "5432";
    $dbname = "fileSharing";
    $user = "postgres";
    $password = "16092006";

    $conn = pg_connect(
        "host=$host port=$port dbname=$dbname user=$user password=$password"
    );

    if (!$conn) {
        die("Kết nối thất bại!");
    }

    echo "Kết nối PostgreSQL thành công!";
?>