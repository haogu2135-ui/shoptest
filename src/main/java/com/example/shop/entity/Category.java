package com.example.shop.entity;

import lombok.Data;
import javax.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

@Data
@Entity
@Table(name = "categories")
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "level", nullable = false)
    private Integer level = 1;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    private String description;

    @Column(name = "localized_content", columnDefinition = "TEXT")
    @JsonIgnore
    private String localizedContent;

    private static final ObjectMapper mapper = new ObjectMapper();

    @JsonProperty("localizedContent")
    public Map<String, Map<String, String>> getLocalizedContentMap() {
        if (localizedContent == null || localizedContent.isEmpty()) return null;
        try {
            return mapper.readValue(localizedContent, new TypeReference<Map<String, Map<String, String>>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    @JsonProperty("localizedContent")
    public void setLocalizedContentMap(Object value) {
        try {
            if (value == null) {
                this.localizedContent = null;
            } else if (value instanceof String) {
                String raw = ((String) value).trim();
                this.localizedContent = raw.isEmpty() ? null : mapper.writeValueAsString(mapper.readValue(raw, new TypeReference<Map<String, Map<String, String>>>() {}));
            } else {
                Map<String, Map<String, String>> map = mapper.convertValue(value, new TypeReference<Map<String, Map<String, String>>>() {});
                this.localizedContent = map == null || map.isEmpty() ? null : mapper.writeValueAsString(map);
            }
        } catch (Exception e) {
            this.localizedContent = null;
        }
    }
} 
