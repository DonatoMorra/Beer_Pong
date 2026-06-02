package com.example.Gioco.a.squadre.Controller;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.Gioco.a.squadre.Model.Partita;
import com.example.Gioco.a.squadre.Model.Squadra;
import com.example.Gioco.a.squadre.Service.SquadreService;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

@RestController
@RequestMapping("/api/squadre")
@CrossOrigin(origins = "*")
public class SquadreController {

    @Autowired
    private SquadreService squadreService;

    @GetMapping("/ip")
    public String getServerIp() {
        String hostIp = System.getenv("HOST_IP");
        if (hostIp != null && !hostIp.isBlank() && !"localhost".equalsIgnoreCase(hostIp.trim())) {
            return hostIp;
        }
        try {
            java.util.Enumeration<java.net.NetworkInterface> interfaces = java.net.NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                java.net.NetworkInterface networkInterface = interfaces.nextElement();
                if (!networkInterface.isUp() || networkInterface.isLoopback() || networkInterface.isVirtual()) {
                    continue;
                }

                java.util.Enumeration<java.net.InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    java.net.InetAddress address = addresses.nextElement();
                    if (address instanceof java.net.Inet4Address && !address.isLoopbackAddress()) {
                        return address.getHostAddress();
                    }
                }
            }

            return java.net.InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            return "localhost";
        }
    }

    @GetMapping(value = "/qr", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> generateQr(@RequestParam("data") String data) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            Map<com.google.zxing.EncodeHintType, Object> hints = new HashMap<>();
            hints.put(com.google.zxing.EncodeHintType.MARGIN, 1);

            BitMatrix matrix = writer.encode(data, BarcodeFormat.QR_CODE, 320, 320, hints);
            BufferedImage image = new BufferedImage(matrix.getWidth(), matrix.getHeight(), BufferedImage.TYPE_INT_RGB);
            for (int x = 0; x < matrix.getWidth(); x++) {
                for (int y = 0; y < matrix.getHeight(); y++) {
                    image.setRGB(x, y, matrix.get(x, y) ? Color.BLACK.getRGB() : Color.WHITE.getRGB());
                }
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            javax.imageio.ImageIO.write(image, "PNG", outputStream);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
                    .contentType(MediaType.IMAGE_PNG)
                    .body(outputStream.toByteArray());
        } catch (WriterException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/auth/check")
    public org.springframework.http.ResponseEntity<String> checkAuth() {
        return org.springframework.http.ResponseEntity.ok("Authenticated");
    }

    @GetMapping
    public List<Squadra> getAll() {
        return squadreService.findAll();
    }

    @PostMapping
    public Squadra create(@RequestBody Squadra s) {
        return squadreService.save(s);
    }

    @PutMapping("/{id}/punti")
    public void updatePunti(@PathVariable Long id, @RequestBody int punti) {
        squadreService.updatePunti(id, punti);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        squadreService.delete(id);
    }

    @DeleteMapping("/all")
    public void deleteAll() {
        squadreService.deleteAll();
    }

    // --- PARTITE ---

    @GetMapping("/partite")
    public List<Partita> getPartite() {
        return squadreService.findAllPartite();
    }

    @PostMapping("/partite")
    public Partita registraPartita(@RequestBody Partita p) {
        return squadreService.registraPartita(p);
    }

    @PostMapping("/partite/nuova")
    public Partita creaPartita(@RequestBody Partita p) {
        return squadreService.savePartita(p);
    }
}
