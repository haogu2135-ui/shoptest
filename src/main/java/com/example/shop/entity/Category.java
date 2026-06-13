package com.example.shop.entity;

import lombok.Data;
import javax.persistence.*;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
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
    @NotBlank
    @Size(max = 100)
    private String name;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "path", length = 500)
    @Size(max = 500)
    private String path;

    @Column(name = "level", nullable = false)
    @NotNull
    @Min(1)
    private Integer level = 1;

    @Column(name = "image_url", columnDefinition = "TEXT")
    @Size(max = 2000)
    private String imageUrl;

    @Size(max = 1000)
    private String description;

    @Transient
    private Long productCount;

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
