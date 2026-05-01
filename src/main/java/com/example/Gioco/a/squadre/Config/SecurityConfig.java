package com.example.Gioco.a.squadre.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.http.HttpStatus;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // Disabilitato per semplicita' in questo progetto locale
                .authorizeHttpRequests(auth -> auth
                        // Permetti a TUTTI di vedere la pagina principale e i dati (Classifica)
                        .requestMatchers("/", "/index.html", "/script.js", "/style.css", "/favicon.ico", "/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/squadre/auth/check").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/squadre/**").permitAll()
                        // Proteggi TUTTE le operazioni di modifica (POST, DELETE, PUT)
                        .anyRequest().authenticated())
                .httpBasic(basic -> basic.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

        return http.build();
    }

    @org.springframework.beans.factory.annotation.Value("${ADMIN_PASSWORD:admin}")
    private String adminPassword;

    @Bean
    public UserDetailsService userDetailsService() {
        UserDetails admin = User.builder()
                .username("admin")
                .password("{noop}" + adminPassword)
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }
}
