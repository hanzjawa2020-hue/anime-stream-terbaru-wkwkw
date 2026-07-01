<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
$url = $_GET['url']?? '';
if(empty($url)) die(json_encode(['error' => 'url kosong']));
$allowed = ['api-aniwatch.onrender.com', 'anistream-api.vercel.app', 'hianime-api.vercel.app', 'kitsu.io'];
$host = parse_url($url, PHP_URL_HOST);
if(!in_array($host, $allowed)) die(json_encode(['error' => 'Host tidak diizinkan']));
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');
echo curl_exec($ch);
?>
